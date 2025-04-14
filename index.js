// CLOZR AI - Deepgram Proxy Server (Mock Mode Enabled)

import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@deepgram/sdk";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const USE_MOCK_DEEPGRAM = true;
const DG_API_KEY = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(DG_API_KEY);

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.send("CLOZR AI Proxy Running ✅"));

// Explicit route for test.html
app.get("/test.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test.html"));
});

wss.on("connection", async (clientSocket) => {
  console.log("🔗 New WebSocket connection");

  let dgSocket;

  if (!USE_MOCK_DEEPGRAM) {
    dgSocket = await deepgram.listen.live({
      encoding: "webm-opus",
      sample_rate: 48000,
      model: "nova",
      punctuate: true,
      interim_results: false,
    });

    dgSocket.on("open", () => console.log("🧠 Connected to Deepgram"));

    dgSocket.on("transcriptReceived", (data) => {
      const transcript = JSON.parse(data);
      if (
        transcript.channel &&
        transcript.channel.alternatives &&
        transcript.channel.alternatives[0].transcript
      ) {
        const text = transcript.channel.alternatives[0].transcript;
        console.log("📝 Transcript:", text);
        clientSocket.send(JSON.stringify({ transcript: text }));
      }
    });

    dgSocket.on("error", (err) => console.error("❌ Deepgram error:", err));
    dgSocket.on("close", () => console.log("🔁 Deepgram socket closed"));
  }

  clientSocket.on("message", (message) => {
    console.log(`📩 Received audio from browser: ${message.byteLength} bytes`);

    if (USE_MOCK_DEEPGRAM) {
      const objections = [
        "too expensive",
        "not interested",
        "think about it",
        "call me back",
      ];
      if (Math.random() > 0.95) {
        const fake = objections[Math.floor(Math.random() * objections.length)];
        clientSocket.send(JSON.stringify({ transcript: fake }));
        console.log("🧪 Sent mock transcript:", fake);
      }
    } else {
      if (dgSocket && dgSocket.getReadyState() === 1) {
        dgSocket.send(message);
        console.log(`📤 Forwarded audio to Deepgram: ${message.byteLength} bytes`);
      }
    }
  });

  clientSocket.on("close", () => {
    console.log("❌ Client disconnected");
    if (!USE_MOCK_DEEPGRAM && dgSocket && dgSocket.getReadyState() === 1) {
      dgSocket.finish();
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 CLOZR AI proxy listening on port ${PORT}`);
});
