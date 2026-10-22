"use strict";

const { checkCollision } = require("./game-state");

const MAX_SPEED_PX_PER_SEC = 125;
const PLAYER_COLLISION_RADIUS = 14;

function processMoveIntent(player, intent, deltaSec = 0.05, dynamicObjects = null) {
  if (!intent || typeof intent !== "object") return false;
  if (player.activeTask) {
    // Character cannot move while busy performing a task
    return false;
  }

  let dx = Number(intent.dx) || 0;
  let dy = Number(intent.dy) || 0;

  if (dx === 0 && dy === 0) {
    if (player.anim === "walk") {
      player.anim = "idle";
      return true;
    }
    return false;
  }

  // Normalize diagonal movement vector
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  const speed = player.isSick ? 55 : MAX_SPEED_PX_PER_SEC;
  const step = Math.min(deltaSec, 0.1) * speed;
  const targetX = player.x + dx * step;
  const targetY = player.y + dy * step;

  let moved = false;

  // Try moving both axes
  if (!checkCollision(targetX, targetY, PLAYER_COLLISION_RADIUS, dynamicObjects)) {
    player.x = Math.round(targetX * 10) / 10;
    player.y = Math.round(targetY * 10) / 10;
    moved = true;
  } else {
    // Sliding: try X axis only
    if (!checkCollision(targetX, player.y, PLAYER_COLLISION_RADIUS, dynamicObjects)) {
      player.x = Math.round(targetX * 10) / 10;
      moved = true;
    }
    // Sliding: try Y axis only
    else if (!checkCollision(player.x, targetY, PLAYER_COLLISION_RADIUS, dynamicObjects)) {
      player.y = Math.round(targetY * 10) / 10;
      moved = true;
    }
  }

  // Update facing direction and animation state
  if (Math.abs(dx) > Math.abs(dy)) {
    player.direction = dx > 0 ? "right" : "left";
  } else if (Math.abs(dy) > 0) {
    player.direction = dy > 0 ? "down" : "up";
  }
  player.anim = moved ? "walk" : "idle";

  return moved;
}

module.exports = {
  MAX_SPEED_PX_PER_SEC,
  PLAYER_COLLISION_RADIUS,
  processMoveIntent
};
