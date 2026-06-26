import "dotenv/config";
import express from "express";
import cors from "cors";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

const app = express();

// --- CORS -------------------------------------------------------------
// CLIENT_URL can hold one or more comma-separated origins (handy when you
// have a local dev URL + a deployed frontend URL at the same time), e.g.
//   CLIENT_URL=http://localhost:5173,https://bytebot-frontend.vercel.app
const clientUrls = (process.env.CLIENT_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...clientUrls,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Vite falls back to these ports if 5173 is already taken
  "http://localhost:4173",
  "http://localhost:5174",
  "https://bytebot-frontend.vercel.app",
  "https://bytebot-project-vahi.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // requests with no Origin header (curl, server-to-server, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`Blocked by CORS: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// --- MongoDB ------------------------------------------------------------
// Cache the connection (and the in-flight connection promise) across
// requests so a burst of requests during a cold start doesn't try to open
// the connection multiple times in parallel, and so we never silently hang
// past the platform's request timeout (which is what turns into a 504 +
// "blocked by CORS" error in the browser, since a 504 from the platform
// itself never carries the Access-Control-Allow-Origin header).
let connectionPromise = null;
const connect = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 20000,
      })
      .then(() => console.log("Connected to MongoDB"))
      .catch((err) => {
        connectionPromise = null; // allow a retry on the next request
        console.error("MongoDB connection error:", err.message);
        throw err;
      });
  }
  return connectionPromise;
};

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

app.use(async (req, res, next) => {
  try {
    await connect();
    next();
  } catch (err) {
    res.status(500).send("Database connection failed");
  }
});

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

app.post("/api/chats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { text } = req.body;
  try {
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });
    const savedChat = await newChat.save();
    const userChats = await UserChats.find({ userId: userId });
    if (!userChats.length) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [{ _id: savedChat._id, title: text.substring(0, 40) }],
      });
      await newUserChats.save();
    } else {
      await UserChats.updateOne(
        { userId: userId },
        { $push: { chats: { _id: savedChat._id, title: text.substring(0, 40) } } }
      );
    }
    res.status(201).send(newChat._id);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating chat!");
  }
});

app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  try {
    const userChats = await UserChats.find({ userId });
    res.status(200).send(userChats[0]?.chats || []);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching userchats!");
  }
});

app.get("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });
    res.status(200).send(chat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching chat!");
  }
});

app.put("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { question, answer, img } = req.body;
  const newItems = [
    ...(question ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }] : []),
    { role: "model", parts: [{ text: answer }] },
  ];
  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      { $push: { history: { $each: newItems } } }
    );
    res.status(200).send(updatedChat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding conversation!");
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).send("Not allowed by CORS");
  }
  res.status(401).send("Unauthenticated!");
});

export default app;
