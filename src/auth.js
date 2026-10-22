"use strict";

const crypto = require("node:crypto");

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateRoomCode() {
  const bytes = crypto.randomBytes(6);
  let result = "GK-";
  for (let i = 0; i < 6; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

function generatePlayerToken() {
  return crypto.randomBytes(24).toString("hex");
}

function generateAdminToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashRoomCode(code, secretKey) {
  const normalized = String(code).trim().toUpperCase();
  return crypto.createHmac("sha256", secretKey).update(normalized).digest("hex");
}

function verifyPassword(inputPassword, expectedPassword) {
  if (typeof inputPassword !== "string" || typeof expectedPassword !== "string") {
    return false;
  }
  const bufA = Buffer.from(inputPassword, "utf8");
  const bufB = Buffer.from(expectedPassword, "utf8");
  if (bufA.length !== bufB.length) {
    // Constant-time compare against self to resist length timing leaks.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  generateRoomCode,
  generatePlayerToken,
  generateAdminToken,
  hashRoomCode,
  verifyPassword
};
