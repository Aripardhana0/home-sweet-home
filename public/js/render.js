"use strict";

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 900;

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.cameraStart = { x: 0, y: 0 };

    this.tick = 0;
    this.highlightedObjectId = null;
    this.setupEvents();
  }

  setupEvents() {
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.cameraStart = { x: this.camera.x, y: this.camera.y };
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = (e.clientX - this.dragStart.x) / this.camera.zoom;
      const dy = (e.clientY - this.dragStart.y) / this.camera.zoom;
      this.camera.x = this.cameraStart.x - dx;
      this.camera.y = this.cameraStart.y - dy;
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.6, Math.min(2.5, this.camera.zoom * zoomFactor));

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = this.camera.x + mouseX / this.camera.zoom;
      const worldY = this.camera.y + mouseY / this.camera.zoom;

      this.camera.zoom = newZoom;
      this.camera.x = worldX - mouseX / newZoom;
      this.camera.y = worldY - mouseY / newZoom;
    }, { passive: false });

    this.canvas.addEventListener("click", (e) => {
      if (this.isDragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = this.camera.x + (e.clientX - rect.left) / this.camera.zoom;
      const clickY = this.camera.y + (e.clientY - rect.top) / this.camera.zoom;

      window.dispatchEvent(new CustomEvent("gk:canvas-clicked", {
        detail: { x: clickX, y: clickY }
      }));
    });
  }

  resetCamera(localPlayer = null) {
    this.camera.zoom = 1.0;
    if (localPlayer && typeof localPlayer.x === "number") {
      this.camera.x = Math.round(localPlayer.x - (this.canvas.width / 2));
      this.camera.y = Math.round(localPlayer.y - (this.canvas.height / 2));
    } else {
      this.camera.x = Math.round((MAP_WIDTH - this.canvas.width) / 2);
      this.camera.y = Math.round((MAP_HEIGHT - this.canvas.height) / 2);
    }
  }

  render(roomState, localRole) {
    this.tick++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = "#090b0e";
    ctx.fillRect(0, 0, w, h);
    ctx.save();

    // Camera transform
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.drawFloors(ctx, roomState);

    // Flat ground objects (drawn under players so they NEVER obscure the avatar)
    const FLAT_OBJECT_IDS = new Set([
      "vegetable_patch", "koi_pond", "garden_path", "living_floor",
      "yoga_mat", "swimming_pool", "photo_spot"
    ]);

    if (roomState && roomState.objects) {
      for (const obj of Object.values(roomState.objects)) {
        if (FLAT_OBJECT_IDS.has(obj.id)) {
          this.drawObject(ctx, obj, obj.id === this.highlightedObjectId);
        }
      }
    }

    this.drawWalls(ctx, roomState);

    // Collect ONLY vertical standing objects for Y-depth sorting
    const renderList = [];

    if (roomState && roomState.objects) {
      for (const obj of Object.values(roomState.objects)) {
        if (!FLAT_OBJECT_IDS.has(obj.id)) {
          renderList.push({
            type: "object",
            y: obj.y + obj.h,
            data: obj
          });
        }
      }
    }

    // Players
    if (roomState && roomState.players) {
      for (const [role, player] of Object.entries(roomState.players)) {
        if (!player.claimed) continue;
        renderList.push({
          type: "player",
          y: player.y,
          role,
          data: player
        });
      }
    }

    // Autonomous Mamacan
    if (roomState && roomState.tiger) {
      renderList.push({
        type: "tiger",
        y: roomState.tiger.y,
        data: roomState.tiger
      });
    }

    // Sort by bottom Y coordinate
    renderList.sort((a, b) => a.y - b.y);

    // Draw entities in depth order
    for (const item of renderList) {
      if (item.type === "object") {
        this.drawObject(ctx, item.data, item.data.id === this.highlightedObjectId);
      } else if (item.type === "player") {
        this.drawPlayer(ctx, item.role, item.data, localRole, roomState);
      } else if (item.type === "tiger") {
        this.drawTiger(ctx, item.data);
      }
    }

    // Overhead UI: Speech bubbles and progress bars
    if (roomState && roomState.players) {
      for (const [role, player] of Object.entries(roomState.players)) {
        if (!player.claimed) continue;
        if (player.bubble) {
          this.drawSpeechBubble(ctx, player.x, player.y - 54, player.bubble.text);
        }
        if (player.activeTask) {
          this.drawProgressBar(ctx, player.x, player.y - 42, player.activeTask);
        }
      }
    }

    // Proximity prompt for local player (STATIC, NO BOUNCING/SHAKING)
    if (localRole && roomState && roomState.players && roomState.players[localRole]) {
      this.drawProximityPrompt(ctx, roomState.players[localRole], roomState.objects, roomState.tiger);
    }

    ctx.restore();
  }

  drawFloors(ctx, roomState) {
    // 1. Kamar Tidur Utama (Warm oak parquet planks)
    ctx.fillStyle = "#6d4223";
    ctx.fillRect(35, 35, 315, 275);
    ctx.fillStyle = "#7d4e2a";
    for (let y = 35; y < 310; y += 18) {
      ctx.fillRect(35, y, 315, 17);
      ctx.fillStyle = "#5a3418";
      const offset = (Math.floor(y / 18) % 2) * 50;
      for (let x = 35 + offset; x < 350; x += 100) {
        ctx.fillRect(x, y, 2, 18);
      }
      ctx.fillStyle = "#7d4e2a";
    }

    // 2. Kamar Mandi & Spa (Glossy teal ceramic tiles)
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(365, 35, 225, 275);
    for (let x = 365; x < 590; x += 25) {
      for (let y = 35; y < 310; y += 25) {
        ctx.fillStyle = (Math.floor(x / 25) + Math.floor(y / 25)) % 2 === 0 ? "#34495e" : "#3c546a";
        ctx.fillRect(x + 1, y + 1, 23, 23);
      }
    }

    // 3. Ruang Olahraga / Gym (Rubber sports floor with workout track)
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(605, 35, 275, 275);
    ctx.fillStyle = "#2d3436";
    for (let x = 605; x < 880; x += 30) {
      for (let y = 35; y < 310; y += 30) {
        ctx.fillRect(x + 2, y + 2, 26, 26);
      }
    }
    ctx.fillStyle = "#e67e22";
    ctx.fillRect(610, 195, 265, 4);

    // 4. Area Kolam Renang Mewah (Top-Right Resort Deck)
    // Sun deck wood
    ctx.fillStyle = "#a0522d";
    ctx.fillRect(895, 35, 470, 560);
    ctx.fillStyle = "#b86237";
    for (let y = 35; y < 595; y += 18) {
      ctx.fillRect(895, y, 470, 16);
    }

    // Swimming Pool Basin (x: 940, y: 180, w: 380, h: 220)
    ctx.fillStyle = "#0984e3";
    ctx.fillRect(940, 180, 380, 220);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.strokeRect(940, 180, 380, 220);

    // Swimming pool water ripples
    ctx.fillStyle = "rgba(116, 185, 255, 0.4)";
    for (let rx = 960; rx < 1300; rx += 55) {
      for (let ry = 200; ry < 380; ry += 35) {
        ctx.fillRect(rx + Math.sin((this.tick + ry) * 0.05) * 6, ry, 32, 4);
      }
    }
    // Pool ladder
    ctx.fillStyle = "#ced6e0";
    ctx.fillRect(945, 185, 14, 25);
    ctx.fillStyle = "#747d8c";
    ctx.fillRect(945, 190, 14, 3);
    ctx.fillRect(945, 198, 14, 3);

    // 5. Dapur Modern & Ruang Makan (Mid-Left)
    ctx.fillStyle = "#8d4f34";
    ctx.fillRect(35, 325, 395, 270);
    for (let x = 35; x < 430; x += 28) {
      for (let y = 325; y < 595; y += 28) {
        ctx.fillStyle = (Math.floor(x / 28) + Math.floor(y / 28)) % 2 === 0 ? "#a25a3a" : "#6e3a22";
        ctx.fillRect(x + 1, y + 1, 26, 26);
      }
    }

    // 6. Ruang Keluarga & Game Lounge (Mid-Center)
    ctx.fillStyle = "#633d1c";
    ctx.fillRect(445, 325, 435, 270);
    ctx.fillStyle = "#774a24";
    for (let y = 325; y < 595; y += 20) {
      ctx.fillRect(445, y, 435, 19);
      ctx.fillStyle = "#543216";
      const offset = (Math.floor(y / 20) % 2) * 60;
      for (let x = 445 + offset; x < 880; x += 120) {
        ctx.fillRect(x, y, 2, 20);
      }
      ctx.fillStyle = "#774a24";
    }

    // Carpet in living room
    ctx.fillStyle = "#4a1942";
    ctx.fillRect(470, 360, 360, 180);
    ctx.strokeStyle = "#e5a93c";
    ctx.lineWidth = 2;
    ctx.strokeRect(474, 364, 352, 172);

    // 7. Taman Asri & Kolam Koi (Bottom-Left, adjacent to Tiger Sanctuary!)
    ctx.fillStyle = "#274e2b";
    ctx.fillRect(35, 610, 685, 255);
    ctx.fillStyle = "#35663a";
    for (let i = 0; i < 60; i++) {
      const gx = 45 + ((i * 37) % 650);
      const gy = 620 + ((i * 43) % 230);
      ctx.fillRect(gx, gy, 3, 4);
    }
    // Flagstone patio under garden table
    ctx.fillStyle = "#57606f";
    ctx.fillRect(70, 625, 390, 85);
    ctx.fillStyle = "#747d8c";
    ctx.fillRect(72, 627, 386, 81);

    // 8. Kandang Macan Eksotis Proporsional (Bottom-Right, directly connected via gate)
    ctx.fillStyle = "#795548";
    ctx.fillRect(720, 620, 610, 225);
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(725, 625, 600, 215);

    // Rock Cave Den for Tiger
    ctx.fillStyle = "#353b48";
    ctx.fillRect(1210, 635, 100, 85);
    ctx.fillStyle = "#1e272e";
    ctx.beginPath();
    ctx.arc(1260, 720, 35, Math.PI, Math.PI * 2);
    ctx.fill();

    // Doorway thresholds (Oak wood transition trims)
    ctx.fillStyle = "#8a5832";
    ctx.fillRect(350, 215, 15, 95);  // Bedroom to spa
    ctx.fillRect(590, 215, 15, 95);  // Spa to gym
    ctx.fillRect(165, 310, 95, 15);  // Bedroom to kitchen/living
    ctx.fillRect(430, 310, 80, 15);  // Spa to living
    ctx.fillRect(680, 310, 100, 15); // Gym to living
    ctx.fillRect(430, 390, 15, 120); // Kitchen to living
    ctx.fillRect(880, 355, 15, 125); // Living to pool deck
    ctx.fillRect(455, 595, 125, 15); // Living to garden
    ctx.fillRect(1060, 595, 140, 15);// Pool deck to tiger walkway

    // Room Label Tags (Crisp HD Font)
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 11px monospace";
    ctx.fillText("[KAMAR TIDUR UTAMA]", 45, 52);
    ctx.fillText("[KAMAR MANDI & SPA]", 375, 52);
    ctx.fillText("[RUANG OLAHRAGA / GYM]", 615, 52);
    ctx.fillText("[KOLAM RENANG MEWAH (BISA RENANG)]", 910, 52);
    ctx.fillText("[DAPUR & RUANG MAKAN]", 45, 345);
    ctx.fillText("[RUANG KELUARGA & GAME LOUNGE]", 455, 345);
    ctx.fillText("[TAMAN ASRI & KOLAM KOI]", 45, 630);
    ctx.fillText("[KANDANG MAMACAN]", 750, 640);
  }

  drawWalls(ctx, roomState) {
    ctx.fillStyle = "#1e272e";
    ctx.strokeStyle = "#0f141a";
    ctx.lineWidth = 2;

    // Outer perimeter (1400x900)
    ctx.fillRect(20, 20, 1360, 15);
    ctx.fillRect(20, 865, 1360, 15);
    ctx.fillRect(20, 20, 15, 860);
    ctx.fillRect(1365, 20, 15, 860);

    // Interior walls
    ctx.fillRect(350, 35, 15, 180);
    ctx.fillRect(590, 35, 15, 180);

    ctx.fillRect(35, 310, 130, 15);
    ctx.fillRect(260, 310, 170, 15);
    ctx.fillRect(510, 310, 170, 15);
    ctx.fillRect(780, 310, 115, 15);

    ctx.fillRect(880, 35, 15, 120);
    ctx.fillRect(880, 260, 15, 100);
    ctx.fillRect(880, 500, 15, 100);

    ctx.fillRect(430, 325, 15, 65);
    ctx.fillRect(430, 510, 15, 85);

    ctx.fillRect(35, 600, 420, 15);
    ctx.fillRect(580, 600, 300, 15);
    ctx.fillRect(880, 600, 180, 15);
    ctx.fillRect(1200, 600, 165, 15);

    // Tiger enclosure perimeter fence (x: 750..1320, y: 625..845)
    ctx.strokeStyle = "#535c68";
    ctx.lineWidth = 3;
    ctx.strokeRect(750, 625, 570, 220);

    // Fence vertical bars
    ctx.strokeStyle = "rgba(149, 175, 192, 0.75)";
    ctx.lineWidth = 1.5;
    for (let fx = 750; fx < 1320; fx += 18) {
      ctx.beginPath(); ctx.moveTo(fx, 625); ctx.lineTo(fx, 845); ctx.stroke();
    }

    // Interactive Tiger Gate
    const gateOpen = roomState && roomState.objects && roomState.objects.tiger_gate && roomState.objects.tiger_gate.state === "open";
    if (!gateOpen) {
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(748, 695, 16, 70);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("LOCKED", 756, 730);
    } else {
      ctx.fillStyle = "#27ae60";
      ctx.fillRect(732, 695, 18, 14);
      ctx.fillStyle = "#2ecc71";
      ctx.font = "bold 9px monospace";
      ctx.fillText("OPEN", 756, 730);
    }

    // 3D wall top highlights
    ctx.fillStyle = "#34495e";
    ctx.fillRect(20, 20, 1360, 4);
    ctx.fillRect(350, 35, 15, 4);
    ctx.fillRect(590, 35, 15, 4);
    ctx.fillRect(35, 310, 130, 4);
    ctx.fillRect(260, 310, 170, 4);
    ctx.fillRect(510, 310, 170, 4);
    ctx.fillRect(780, 310, 115, 4);
    ctx.fillRect(880, 35, 15, 4);
    ctx.fillRect(880, 480, 15, 4);
    ctx.fillRect(430, 325, 15, 4);
    ctx.fillRect(430, 510, 15, 4);
    ctx.fillRect(35, 595, 420, 4);
    ctx.fillRect(580, 595, 300, 4);
    ctx.fillRect(880, 595, 180, 4);
    ctx.fillRect(1200, 595, 165, 4);
  }

  drawObject(ctx, obj, isHighlighted = false) {
    const { x, y, w, h, id } = obj;
    ctx.save();

    if (obj.solid && id !== "swimming_pool" && id !== "tiger_gate") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.fillRect(x + 4, y + h - 2, w - 4, 8);
    }

    if (isHighlighted) {
      ctx.strokeStyle = "#e5a93c";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    }

    if (id === "bed_double") {
      ctx.fillStyle = "#4a2408";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#5c3317";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 12, y + 10, 38, 22);
      ctx.fillRect(x + w - 50, y + 10, 38, 22);

      ctx.fillStyle = "#1b4d79";
      ctx.fillRect(x + 6, y + 40, w - 12, h - 46);
      ctx.fillStyle = "#24649c";
      ctx.fillRect(x + 6, y + 40, w - 12, 10);
    } else if (id === "nightstand") {
      ctx.fillStyle = "#5c3317";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#f1c40f";
      ctx.beginPath(); ctx.arc(x + w / 2, y + 15, 10, 0, Math.PI * 2); ctx.fill();
    } else if (id === "wardrobe") {
      ctx.fillStyle = "#3e1f07";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#542c0c";
      ctx.fillRect(x + 2, y + 2, w / 2 - 3, h - 4);
      ctx.fillRect(x + w / 2 + 1, y + 2, w / 2 - 3, h - 4);
      ctx.fillStyle = "#e5a93c";
      ctx.fillRect(x + w / 2 - 4, y + h / 2 - 4, 2, 8);
      ctx.fillRect(x + w / 2 + 2, y + h / 2 - 4, 2, 8);
    } else if (id === "shower") {
      ctx.fillStyle = "rgba(41, 128, 185, 0.2)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#bdc3c7";
      ctx.fillRect(x + w / 2 - 5, y + 4, 10, 8);
    } else if (id === "bathroom_sink") {
      ctx.fillStyle = "#bdc3c7";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#2980b9";
      ctx.fillRect(x + 8, y + 10, w - 16, h - 18);
      ctx.fillStyle = "#95a5a6";
      ctx.fillRect(x + w / 2 - 3, y + 3, 6, 8);
    } else if (id === "toilet") {
      ctx.fillStyle = "#ecf0f1";
      ctx.fillRect(x + 6, y, w - 12, 18);
      ctx.fillStyle = "#dfe4ea";
      ctx.fillRect(x + 4, y + 18, w - 8, h - 18);
    } else if (id === "treadmill") {
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#111111";
      ctx.fillRect(x + 10, y + 15, w - 20, h - 25);
      ctx.fillStyle = "#00d2d3";
      ctx.fillRect(x + 15, y + 4, w - 30, 8);
    } else if (id === "bench_press") {
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(x + 15, y + 10, w - 30, h - 20);
      ctx.fillStyle = "#747d8c";
      ctx.fillRect(x, y + 25, w, 6);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(x + 4, y + 18, 6, 20);
      ctx.fillRect(x + w - 10, y + 18, 6, 20);
    } else if (id === "yoga_mat") {
      ctx.fillStyle = "#a29bfe";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#6c5ce7";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    } else if (id === "pool_lounge") {
      // 2 Loungers with beach umbrella
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 8, y + 8, 52, 26);
      ctx.fillRect(x + 75, y + 8, 52, 26);
      ctx.fillStyle = "#0984e3";
      ctx.fillRect(x + 8, y + 8, 52, 8);
      ctx.fillRect(x + 75, y + 8, 52, 8);
      // Beach umbrella
      ctx.fillStyle = "#e84393";
      ctx.beginPath(); ctx.arc(x + w / 2, y + 55, 18, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fdcb6e";
      ctx.fillRect(x + w / 2 - 2, y + 55, 4, 18);
    } else if (id === "stove") {
      ctx.fillStyle = "#222f3e";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath(); ctx.arc(x + 20, y + h / 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 20, y + h / 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff9f43";
      ctx.beginPath(); ctx.arc(x + 20, y + h / 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 20, y + h / 2, 5, 0, Math.PI * 2); ctx.fill();
    } else if (id === "kitchen_sink") {
      ctx.fillStyle = "#57606f";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
      ctx.fillStyle = "#ced6e0";
      ctx.fillRect(x + w / 2 - 3, y + 3, 6, 8);
    } else if (id === "fridge") {
      ctx.fillStyle = "#dfe4ea";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#a4b0be";
      ctx.fillRect(x, y + h * 0.38, w, 3);
      ctx.fillStyle = "#747d8c";
      ctx.fillRect(x + 6, y + 12, 3, 16);
      ctx.fillRect(x + 6, y + h * 0.38 + 12, 3, 22);
    } else if (id === "dining_table") {
      ctx.fillStyle = "#79441a";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#8a5023";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

      ctx.fillStyle = "#5c3317";
      ctx.fillRect(x + 20, y - 12, 28, 12);
      ctx.fillRect(x + w - 48, y - 12, 28, 12);
      ctx.fillRect(x + 20, y + h, 28, 12);
      ctx.fillRect(x + w - 48, y + h, 28, 12);

      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(x + 35, y + h / 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 35, y + h / 2, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e5a93c";
      ctx.fillRect(x + w / 2 - 6, y + h / 2 - 6, 12, 12);
    } else if (id === "trash_bin") {
      ctx.fillStyle = "#747d8c";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#2f3542";
      ctx.fillRect(x - 2, y, w + 4, 6);
    } else if (id === "living_sofa") {
      ctx.fillStyle = "#4c2647";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#63325c";
      ctx.fillRect(x + 8, y + 8, w - 16, h - 22);
      ctx.fillStyle = "#e5a93c";
      ctx.fillRect(x + 14, y + 12, 22, 20);
      ctx.fillRect(x + w - 36, y + 12, 22, 20);
    } else if (id === "living_tv") {
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#00d2d3";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

      const colors = ["#ff9ff3", "#54a0ff", "#5f27cd", "#1dd1a1"];
      const colIndex = Math.floor(this.tick / 15) % colors.length;
      ctx.fillStyle = colors[colIndex];
      ctx.fillRect(x + 8, y + 6, w - 16, 3);
    } else if (id === "board_game_table") {
      ctx.fillStyle = "#8a5832";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(x + 15, y + 10, w - 30, h - 20);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + w / 2 - 8, y + h / 2 - 8, 8, 8);
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath(); ctx.arc(x + w / 2 + 8, y + h / 2, 4, 0, Math.PI * 2); ctx.fill();
    } else if (id === "bookshelf") {
      ctx.fillStyle = "#5c3317";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#8a5832";
      ctx.fillRect(x + 4, y + 15, w - 8, 3);
      ctx.fillRect(x + 4, y + 45, w - 8, 3);
      ctx.fillStyle = "#e74c3c"; ctx.fillRect(x + 8, y + 2, 6, 13);
      ctx.fillStyle = "#3498db"; ctx.fillRect(x + 16, y + 2, 6, 13);
      ctx.fillStyle = "#2ecc71"; ctx.fillRect(x + 24, y + 2, 6, 13);
    } else if (id === "record_player") {
      ctx.fillStyle = "#4a2c11";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#1e272e";
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e5a93c";
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 5, 0, Math.PI * 2); ctx.fill();
    } else if (id === "terrace_table") {
      ctx.fillStyle = "#5c3317";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#79441a";
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(x + 25, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 25, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
    } else if (id === "garden_bench") {
      ctx.fillStyle = "#2d3436";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#b2bec3";
      ctx.fillRect(x + 4, y + 4, w - 8, 14);
    } else if (id === "flower_pot") {
      ctx.fillStyle = "#b54418";
      ctx.fillRect(x + 8, y + 18, w - 16, h - 18);
      ctx.fillStyle = "#27ae60";
      ctx.fillRect(x + 12, y + 6, w - 24, 14);
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath(); ctx.arc(x + 16, y + 8, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 16, y + 8, 6, 0, Math.PI * 2); ctx.fill();
    } else if (id === "garden_grill") {
      ctx.fillStyle = "#1e272e";
      ctx.beginPath(); ctx.arc(x + w / 2, y + 25, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(x + w / 2 - 12, y + 23, 24, 4);
      ctx.fillStyle = "#747d8c";
      ctx.fillRect(x + 10, y + 35, 4, 25);
      ctx.fillRect(x + w - 14, y + 35, 4, 25);
    } else if (id === "koi_pond") {
      ctx.fillStyle = "#57606f";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#747d8c";
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = "#1abc9c";
      ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
      ctx.fillStyle = "rgba(46, 204, 113, 0.35)";
      ctx.fillRect(x + 8, y + 8, w - 16, h - 16);

      const t = this.tick;
      // Koi 1: Kohaku (White & Orange)
      const k1x = x + 18 + ((t * 0.4) % (w - 36));
      const k1y = y + 25 + Math.sin(t * 0.1) * 6;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(k1x, k1y, 14, 6);
      ctx.fillStyle = "#e67e22";
      ctx.fillRect(k1x + 3, k1y + 1, 6, 4);

      // Koi 2: Golden Ogon (Metallic Gold)
      const k2x = x + w - 24 - ((t * 0.35) % (w - 36));
      const k2y = y + 55 + Math.sin(t * 0.12) * 5;
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(k2x, k2y, 13, 5);
      ctx.fillStyle = "#d35400";
      ctx.fillRect(k2x + 9, k2y + 1, 4, 3);

      // Lotus lily pad
      ctx.fillStyle = "#27ae60";
      ctx.beginPath(); ctx.arc(x + 35, y + 60, 8, 0, Math.PI * 1.8); ctx.fill();
      ctx.fillStyle = "#e84393";
      ctx.beginPath(); ctx.arc(x + 35, y + 58, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5a3818";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#8a5832";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      for (let vx = x + 16; vx < x + w - 15; vx += 24) {
        ctx.fillStyle = "#e67e22";
        ctx.fillRect(vx, y + 25, 6, 8);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(vx - 2, y + 18, 10, 7);
      }
    }

    ctx.restore();
  }

  // AUTONOMOUS MAMACAN RENDERING WITH ACTIVE MOVEMENT
  drawTiger(ctx, tiger) {
    const { x, y, direction, anim } = tiger;
    ctx.save();
    ctx.translate(x, y);

    // Tiger ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const isMoving = anim === "walk";
    const walkLeg = isMoving ? Math.sin(this.tick * 0.25) * 5 : 0;
    const tailWag = Math.sin(this.tick * 0.18) * 6;

    const flip = direction === "right" ? -1 : 1;
    ctx.scale(flip, 1);

    // Tiger main body
    ctx.fillStyle = "#e67e22";
    ctx.fillRect(-20, -15, 40, 20);

    // Black stripes
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(-12, -15, 3, 11);
    ctx.fillRect(-3, -15, 3, 12);
    ctx.fillRect(6, -15, 3, 11);
    ctx.fillRect(14, -15, 3, 9);

    // White underbelly
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-16, 1, 32, 4);

    // 4 Walking legs with paws
    ctx.fillStyle = "#d35400";
    ctx.fillRect(-18, 5 + walkLeg, 7, 9);
    ctx.fillRect(-7, 5 - walkLeg, 7, 9);
    ctx.fillRect(4, 5 + walkLeg, 7, 9);
    ctx.fillRect(14, 5 - walkLeg, 7, 9);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-18, 12 + walkLeg, 7, 3);
    ctx.fillRect(-7, 12 - walkLeg, 7, 3);
    ctx.fillRect(4, 12 + walkLeg, 7, 3);
    ctx.fillRect(14, 12 - walkLeg, 7, 3);

    // Tiger head
    ctx.fillStyle = "#e67e22";
    ctx.fillRect(-35, -24, 20, 20);
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(-29, -24, 3, 6);
    ctx.fillRect(-24, -24, 3, 5);

    // Ears
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(-35, -28, 5, 5);
    ctx.fillRect(-20, -28, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-34, -27, 3, 3);
    ctx.fillRect(-19, -27, 3, 3);

    // White snout & nose
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-37, -14, 10, 8);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-36, -12, 3, 2);

    // Sparkling green eyes with blinking
    const isBlink = (this.tick % 110 > 105);
    if (isBlink) {
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(-29, -19, 3, 1);
    } else {
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(-29, -20, 3, 3);
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(-28, -20, 1, 3);
    }

    // Long curved tail
    ctx.fillStyle = "#e67e22";
    ctx.fillRect(20, -8 + tailWag, 15, 4);
    ctx.fillStyle = "#1e272e";
    ctx.fillRect(30, -8 + tailWag, 6, 4);

    // Name badge overhead
    ctx.fillStyle = "#e5a93c";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MAMACAN", 0, -32);

    ctx.restore();
  }

  drawPlayer(ctx, role, player, localRole, roomState) {
    const { x, y, direction, anim, activeTask, isSick } = player;
    ctx.save();
    ctx.translate(x, y);

    // REAL-TIME SWIMMING IMMERSION DETECTION
    const pool = roomState && roomState.objects && roomState.objects.swimming_pool;
    const inPool = pool && (x >= pool.x && x <= pool.x + pool.w && y >= pool.y && y <= pool.y + pool.h);

    if (!inPool) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 4, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const isMoving = anim === "walk";
    const walkRate = isSick ? 0.09 : 0.16;
    const walkCycle = isMoving ? (this.tick * walkRate) : 0;
    const legSwing = isMoving ? Math.sin(walkCycle) * 4 : 0;
    const armSwing = isMoving ? Math.cos(walkCycle) * 3 : 0;
    const bobbing = isMoving ? Math.abs(Math.sin(walkCycle)) * 1.5 : 0;

    const taskAnim = activeTask ? (activeTask.animation || "work") : null;

    if (role === "karip") {
      // KARIP
      if (!inPool) {
        ctx.fillStyle = "#1e3799";
        ctx.fillRect(-7, -10 + legSwing - bobbing, 6, 12);
        ctx.fillRect(1, -10 - legSwing - bobbing, 6, 12);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-8, 2 + legSwing - bobbing, 7, 4);
        ctx.fillRect(1, 2 - legSwing - bobbing, 7, 4);
      }

      ctx.fillStyle = inPool ? "#2980b9" : "#e67e22";
      ctx.fillRect(-9, -24 - bobbing, 18, inPool ? 12 : 15);
      if (!inPool) {
        ctx.fillStyle = "#d35400";
        ctx.fillRect(-2, -24 - bobbing, 4, 7);
      }

      ctx.fillStyle = isSick ? "#ecdcb9" : "#f5cd79";
      ctx.fillRect(-7, -36 - bobbing, 14, 12);

      ctx.fillStyle = "#2d3436";
      if (direction === "up") {
        ctx.fillRect(-7, -37 - bobbing, 14, 13);
      } else {
        ctx.fillRect(-7, -37 - bobbing, 14, 6);
        ctx.fillRect(-7, -35 - bobbing, 3, 6);
        ctx.fillRect(4, -35 - bobbing, 3, 6);
        ctx.fillStyle = "#4b4b4b";
        ctx.fillRect(-5, -37 - bobbing, 10, 2);

        const isBlinking = this.tick % 120 > 115;
        ctx.fillStyle = "#2d3436";
        if (isSick) {
          ctx.fillRect(-4, -29 - bobbing, 3, 1);
          ctx.fillRect(2, -29 - bobbing, 3, 1);
        } else if (isBlinking) {
          ctx.fillRect(-4, -29 - bobbing, 2, 1);
          ctx.fillRect(2, -29 - bobbing, 2, 1);
        } else if (direction === "down") {
          ctx.fillRect(-4, -30 - bobbing, 2, 2);
          ctx.fillRect(2, -30 - bobbing, 2, 2);
        } else if (direction === "left") {
          ctx.fillRect(-5, -30 - bobbing, 2, 2);
        } else if (direction === "right") {
          ctx.fillRect(3, -30 - bobbing, 2, 2);
        }
      }
    } else {
      // GABIN (Hijab covering hair in all frame directions)
      if (!inPool) {
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(-8, -12 - bobbing, 16, 14);

        ctx.fillStyle = "#bdc3c7";
        ctx.fillRect(-7, 2 + legSwing - bobbing, 6, 3);
        ctx.fillRect(1, 2 - legSwing - bobbing, 6, 3);
      }

      ctx.fillStyle = inPool ? "#00cec9" : "#d63031";
      ctx.fillRect(-9, -24 - bobbing, 18, inPool ? 12 : 14);
      if (!inPool) {
        ctx.fillStyle = "#ff7675";
        ctx.fillRect(-9, -24 - bobbing, 18, 3);
      }

      // HIJAB
      ctx.fillStyle = "#00b894";
      ctx.fillRect(-8, -38 - bobbing, 16, 17);
      ctx.fillRect(-9, -23 - bobbing, 18, 6);

      ctx.fillStyle = "#55efc4";
      ctx.fillRect(-7, -38 - bobbing, 14, 2);
      ctx.fillRect(-8, -22 - bobbing, 16, 2);

      if (direction !== "up") {
        ctx.fillStyle = isSick ? "#e6dcbe" : "#ffeaa7";
        if (direction === "down") {
          ctx.fillRect(-5, -34 - bobbing, 10, 10);
          ctx.fillStyle = "#2d3436";
          if (isSick) {
            ctx.fillRect(-3, -29 - bobbing, 3, 1);
            ctx.fillRect(1, -29 - bobbing, 3, 1);
          } else {
            const isBlinking = this.tick % 130 > 125;
            if (isBlinking) {
              ctx.fillRect(-3, -29 - bobbing, 2, 1);
              ctx.fillRect(1, -29 - bobbing, 2, 1);
            } else {
              ctx.fillRect(-3, -30 - bobbing, 2, 2);
              ctx.fillRect(1, -30 - bobbing, 2, 2);
            }
            ctx.fillStyle = "#ff7675";
            ctx.fillRect(-4, -27 - bobbing, 2, 1);
            ctx.fillRect(2, -27 - bobbing, 2, 1);
          }
        } else if (direction === "left") {
          ctx.fillRect(-6, -34 - bobbing, 8, 10);
          ctx.fillStyle = "#2d3436";
          ctx.fillRect(-4, -30 - bobbing, 2, 2);
        } else if (direction === "right") {
          ctx.fillRect(-2, -34 - bobbing, 8, 10);
          ctx.fillStyle = "#2d3436";
          ctx.fillRect(2, -30 - bobbing, 2, 2);
        }
      }
    }

    // REAL-TIME SWIMMING WATER IMMERSION
    if (inPool) {
      ctx.fillStyle = "rgba(116, 185, 255, 0.65)";
      ctx.beginPath();
      ctx.ellipse(0, -6, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      const splash = Math.sin(this.tick * 0.25) * 8;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(splash, -12, 2, 2);
      ctx.fillRect(-splash, -14, 2, 2);
    }

    // SICK / DIZZY OVERHEAD INDICATOR
    if (isSick) {
      const dizzyAngle = this.tick * 0.15;
      const starX = Math.cos(dizzyAngle) * 9;
      const starY = Math.sin(dizzyAngle) * 4;
      ctx.fillStyle = "#f39c12";
      ctx.font = "12px sans-serif";
      ctx.fillText("💫", starX, -46 + starY);
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#e74c3c";
      ctx.fillText("[LEMAS]", 0, -56);
    }

    // Custom Activity Animation Overlay
    if (taskAnim) {
      this.drawActivityAnimation(ctx, taskAnim);
    }

    // Role Indicator Badge
    ctx.fillStyle = role === localRole ? "#e5a93c" : "#dfe4ea";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(role.toUpperCase(), 0, isSick ? -66 : -44);

    ctx.restore();
  }

  drawActivityAnimation(ctx, taskAnim) {
    const time = this.tick;

    if (taskAnim === "workout") {
      ctx.fillStyle = "#1e272e";
      ctx.fillRect(8, -20 + Math.sin(time * 0.3) * 6, 8, 4);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(6, -22 + Math.sin(time * 0.3) * 6, 4, 8);
      ctx.fillRect(14, -22 + Math.sin(time * 0.3) * 6, 4, 8);
    } else if (taskAnim === "feed" || taskAnim === "pet") {
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(8, -14, 8, 6);
      ctx.fillStyle = "#e67e22";
      ctx.fillRect(10, -16, 4, 4);
      ctx.fillStyle = "#ff4757";
      ctx.font = "14px sans-serif";
      const heartX = 14 + (time % 30);
      ctx.fillText("❤️", heartX, -24);
    } else if (taskAnim === "sweep" || taskAnim === "clean") {
      const sweepAngle = Math.sin(time * 0.2) * 0.4;
      ctx.save();
      ctx.translate(8, -12);
      ctx.rotate(sweepAngle);
      ctx.fillStyle = "#8a5832";
      ctx.fillRect(-1, -18, 3, 26);
      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(-4, 8, 9, 8);
      ctx.restore();

      ctx.fillStyle = "rgba(236, 240, 241, 0.6)";
      const dustX = 8 + Math.cos(time * 0.3) * 6;
      ctx.fillRect(dustX, 2, 2, 2);
    } else if (taskAnim === "cook") {
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(8, -16, 12, 4);
      ctx.beginPath(); ctx.arc(18, -14, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f1c40f";
      ctx.beginPath(); ctx.arc(18, -14, 3, 0, Math.PI * 2); ctx.fill();

      // Steam puffs
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      const steamY = -22 - ((time * 0.8) % 18);
      ctx.beginPath(); ctx.arc(17 + Math.sin(time * 0.2) * 3, steamY, 3, 0, Math.PI * 2); ctx.fill();
    } else if (taskAnim === "water") {
      ctx.fillStyle = "#3498db";
      ctx.fillRect(8, -16, 10, 8);
      ctx.fillRect(16, -18, 6, 3);
      ctx.fillStyle = "#70a1ff";
      const dropY = -12 + ((time * 1.5) % 16);
      ctx.fillRect(20, dropY, 2, 4);
    } else if (taskAnim === "sleep") {
      ctx.fillStyle = "#a4b0be";
      ctx.font = "bold 11px sans-serif";
      const zOffset = (time * 0.6) % 24;
      ctx.fillText("z", 8, -38 - zOffset);
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("Z", 14, -46 - zOffset);
    } else if (taskAnim === "wash") {
      ctx.fillStyle = "#70a1ff";
      ctx.fillRect(6, -16, 2, 6);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(10, -18, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -22, 2, 0, Math.PI * 2); ctx.fill();
    } else if (taskAnim === "hug") {
      ctx.fillStyle = "#ff4757";
      ctx.font = "14px sans-serif";
      const heartY = -48 - Math.sin(time * 0.15) * 4;
      ctx.fillText("💖", 0, heartY);
    } else if (taskAnim === "watch") {
      ctx.fillStyle = "rgba(0, 210, 211, 0.25)";
      ctx.beginPath(); ctx.arc(0, -20, 16, 0, Math.PI * 2); ctx.fill();
    } else if (taskAnim === "game") {
      ctx.fillStyle = "#e5a93c";
      ctx.font = "12px sans-serif";
      ctx.fillText("🎲", 8, -26);
    } else if (taskAnim === "music") {
      ctx.fillStyle = "#a29bfe";
      ctx.font = "14px sans-serif";
      const noteY = -34 - ((time * 0.5) % 20);
      ctx.fillText("♫", 10, noteY);
    }
  }

  drawSpeechBubble(ctx, x, y, text) {
    ctx.save();
    ctx.font = "bold 12px sans-serif";
    const textWidth = ctx.measureText(text).width;
    const padding = 10;
    const boxWidth = Math.max(52, textWidth + padding * 2);
    const boxHeight = 26;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#12151c";
    ctx.lineWidth = 2;

    const bx = x - boxWidth / 2;
    const by = y - boxHeight;

    ctx.beginPath();
    ctx.roundRect(bx, by, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#12151c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, by + boxHeight / 2);
    ctx.restore();
  }

  drawProgressBar(ctx, x, y, activeTask) {
    const elapsed = Date.now() - activeTask.startTime;
    const progress = Math.min(1.0, elapsed / activeTask.durationMs);

    ctx.save();
    const barWidth = 48;
    const barHeight = 6;
    const bx = x - barWidth / 2;
    const by = y;

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

    ctx.fillStyle = "#e5a93c";
    ctx.fillRect(bx, by, barWidth * progress, barHeight);
    ctx.restore();
  }

  // FIXED: COMPLETELY STATIC, CLEAN, HIGH-CONTRAST PROMPT (ZERO BOUNCE / SHAKING)
  drawProximityPrompt(ctx, player, objects, tiger) {
    let candidate = null;
    let minDist = 9999;

    // Check furniture / objects
    if (objects) {
      for (const obj of Object.values(objects)) {
        const targetX = obj.interactX ?? (obj.x + obj.w / 2);
        const targetY = obj.interactY ?? (obj.y + obj.h / 2);
        const maxDist = (obj.radius || 60) + 25;
        const dist = Math.hypot(player.x - targetX, player.y - targetY);
        if (dist <= maxDist && dist < minDist) {
          minDist = dist;
          candidate = { name: obj.name, x: targetX, y: targetY };
        }
      }
    }

    // Check autonomous tiger
    if (tiger) {
      const dist = Math.hypot(player.x - tiger.x, player.y - tiger.y);
      if (dist <= 85 && dist < minDist) {
        minDist = dist;
        candidate = { name: "Mamacan", x: tiger.x, y: tiger.y };
      }
    }

    if (candidate) {
      ctx.save();
      const text = `[E] ${candidate.name}`;
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Dark outline for contrast
      ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(text, candidate.x, candidate.y - 20);

      // Gold text fill without background box
      ctx.fillStyle = "#e5a93c";
      ctx.fillText(text, candidate.x, candidate.y - 20);
      ctx.restore();
    }
  }
}

window.GameRenderer = GameRenderer;
