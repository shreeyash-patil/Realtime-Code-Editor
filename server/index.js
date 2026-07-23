import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { pool } from "./db.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();

pubClient.on("error", (err) => console.error("[redis pub] error:", err));
subClient.on("error", (err) => console.error("[redis sub] error:", err));
pubClient.on("connect", () => console.log("[redis] connected"))

io.adapter(createAdapter(pubClient, subClient));

// In-memory room state: roomId -> Map<socketId, username>
const rooms = new Map();

function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function broadcastUserList(roomId) {
  const users = rooms.get(roomId);
  if (!users) return;
  io.to(roomId).emit("room-users", Array.from(users.values()));
}

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;

    const users = getRoomUsers(roomId);
    users.set(socket.id, username);

    broadcastUserList(roomId);
    console.log(`[join] ${username} (${socket.id}) -> room ${roomId}`);
  });

  socket.on("code-change", (code) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("code-change", code);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const users = rooms.get(roomId);
      users.delete(socket.id);
      if (users.size === 0) {
        rooms.delete(roomId);
      } else {
        broadcastUserList(roomId);
      }
    }
    console.log(`[disconnect] ${socket.id}`);
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("[postgres] connection test failed:", err);
  } else {
    console.log("[postgres] connected, server time:", res.rows[0].now);
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});