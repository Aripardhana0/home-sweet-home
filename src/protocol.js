"use strict";

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseClientEnvelope(data) {
  try {
    const raw = typeof data === "string" ? data : data.toString();
    if (raw.length > 65536) return null;
    const msg = JSON.parse(raw);
    if (!msg || typeof msg !== "object") return null;
    if (typeof msg.type !== "string") return null;
    return msg;
  } catch {
    return null;
  }
}

function createEnvelope(type, payload = {}, requestId = null, roomId = null) {
  return JSON.stringify({
    type,
    payload,
    requestId,
    roomId,
    timestamp: Date.now()
  });
}

module.exports = {
  escapeHtml,
  parseClientEnvelope,
  createEnvelope
};
