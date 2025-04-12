// CLOZR AI - Deepgram Proxy Server (Deepgram SDK v3)

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

const DG_API_KEY = process.env.DEEPGRAM_API_KEY;
const deepgram = createClient(DG_API_KEY);

app.use(cors());
app.get("/", (req, res) => res.send("CLOZR AI Proxy Running ✅"));

wss.on("connection", async function connection(clientSocket) {
  console.log("🔗 New WebSocket connection");

  const dgSocket = await deepgram.listen.live({
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
    model: "nova",
    punctuate: true,
    interim_results: false,
  });

  dgSocket.on("open", () => {
    console.log("🧠 Connected to Deepgram");

    clientSocket.on("message", (message) => {
      console.log(`📩 Received audio from browser: ${message.byteLength} bytes`);
      if (dgSocket.getReadyState() === 1) {
        dgSocket.send(message);
        console.log(`📤 Forwarded audio to Deepgram: ${message.byteLength} bytes`);
      }
    });

    clientSocket.on("close", () => {
      console.log("❌ Client disconnected");
      if (
        dgSocket &&
        typeof dgSocket.finish === "function" &&
        dgSocket.getReadyState() === 1
      ) {
        dgSocket.finish();
      }
    });
  });

  dgSocket.on("transcriptReceived", (data) => {
    console.log("🎧 Raw data from Deepgram:", data);
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

  dgSocket.on("error", (error) => {
    console.error("❌ Deepgram error:", error);
  });

  dgSocket.on("close", () => {
    console.log("🔁 Deepgram socket closed");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 CLOZR AI proxy listening on port ${PORT}`);
});