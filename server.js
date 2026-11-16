
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://kylegoertzen242.github.io"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const DATA_DIR = path.join(__dirname, "data");
const PEERS_FILE = path.join(DATA_DIR, "peers.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(PEERS_FILE)) {
  fs.writeFileSync(PEERS_FILE, "[]");
}

const startedAt = Date.now();
const NODE_ID = process.env.NODE_ID || "friendcode-node-01";

function getPeers() {
  try {
    return JSON.parse(fs.readFileSync(PEERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function savePeers(peers) {
  fs.writeFileSync(PEERS_FILE, JSON.stringify(peers, null, 2));
}

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "FriendCodeForum Node",
    timestamp: new Date().toISOString()
  });
});

// Node status
app.get("/api/status", (req, res) => {
  const peers = getPeers();

  res.json({
    name: "FriendCodeForum Node",
    id: NODE_ID,
    status: "online",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    peers: peers.length,
    timestamp: new Date().toISOString()
  });
});

// List registered peers
app.get("/api/peers", (req, res) => {
  res.json({
    peers: getPeers()
  });
});

// Register a peer
app.post("/api/peers", (req, res) => {
  const { name, url } = req.body || {};

  if (
    typeof name !== "string" ||
    typeof url !== "string" ||
    name.length < 1 ||
    name.length > 80 ||
    url.length > 300
  ) {
    return res.status(400).json({
      error: "Valid peer name and URL required"
    });
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({
      error: "Invalid peer URL"
    });
  }

  if (parsed.protocol !== "https:") {
    return res.status(400).json({
      error: "Peer URL must use HTTPS"
    });
  }

  const peers = getPeers();

  if (peers.some(peer => peer.url === parsed.origin)) {
    return res.status(409).json({
      error: "Peer already registered"
    });
  }

  const peer = {
    id: crypto.randomUUID(),
    name,
    url: parsed.origin,
    registeredAt: new Date().toISOString()
  };

  peers.push(peer);
  savePeers(peers);

  res.status(201).json({
    success: true,
    peer
  });
});

// Remove a peer
app.delete("/api/peers/:id", (req, res) => {
  const peers = getPeers();
  const updated = peers.filter(peer => peer.id !== req.params.id);

  if (updated.length === peers.length) {
    return res.status(404).json({
      error: "Peer not found"
    });
  }

  savePeers(updated);
  res.json({ success: true });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`FriendCodeForum node listening on ${PORT}`);
});
