import app from "../src/server";

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}