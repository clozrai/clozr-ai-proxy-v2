// CLOZR AI - Deepgram Proxy Server

import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@deepgram/sdk";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const USE_MOCK_DEEPGRAM = true; // Flip to false when ready to go live
const DG_API_KEY = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(DG_API_KEY);

app.use(cors());
app.get("/", (req, res) => res.send("CLOZR AI Proxy Running ✅"));

wss.on("connection", async function connection(clientSocket) {
  console.log("🔗 New WebSocket connection");

  let dgSocket;

  if (!USE_MOCK_DEEPGRAM) {
    try {
      dgSocket = await deepgram.listen.live({
        encoding: "webm-opus",
        sample_rate: 48000,
        model: "nova",
        punctuate: true,
        interim_results: false,
      });

      dgSocket.on("open", () => {
        console.log("🧠 Connected to Deepgram");
      });

      dgSocket.on("transcriptReceived", (data) => {
        const transcript = JSON.parse(data);
        const text = transcript.channel?.alternatives?.[0]?.transcript;
        if (text) {
          console.log("📝 Transcript:", text);
          clientSocket.send(JSON.stringify({ transcript: text }));
        }
      });

      dgSocket.on("error", (error) => {
        console.error("❌ Deepgram error:", error);
      });

      dgSocket.on("close", () => {
        console.log("🔁 Deepgram socket closed");
      });
    } catch (error) {
      console.error("❌ Failed to connect to Deepgram:", error);
    }
  }

  clientSocket.on("message", (message) => {
    console.log(`📩 Received audio: ${message.byteLength} bytes`);

    if (USE_MOCK_DEEPGRAM) {
      const objections = [
        "too expensive",
        "not interested",
        "think about it",
        "call me back",
        "send me a quote",
        "need to talk to my spouse",
        "not the right time",
        "already working with someone",
        "my budget is 25k",
        "i'm looking for a truck",
        "we'll decide next week",
        "i need to talk to my wife"
      ];
      if (Math.random() > 0.94) {
        const mock = objections[Math.floor(Math.random() * objections.length)];
        clientSocket.send(JSON.stringify({ transcript: mock }));
        console.log("🧪 Mock transcript:", mock);
      }
    } else {
      if (dgSocket?.getReadyState?.() === 1) {
        dgSocket.send(message);
        console.log(`📤 Sent to Deepgram: ${message.byteLength} bytes`);
      }
    }
  });

  clientSocket.on("close", () => {
    console.log("❌ Client disconnected");
    if (!USE_MOCK_DEEPGRAM && dgSocket?.getReadyState?.() === 1) {
      dgSocket.finish();
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 CLOZR AI proxy listening on port ${PORT}`);
});
