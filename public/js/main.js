"use strict";

(function () {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const renderer = new GameRenderer(canvas);
  const network = new NetworkClient();
  const ui = new UIManager(network);

  let currentRoomState = null;
  let localRole = null;

  const input = new InputManager(
    network,
    () => currentRoomState,
    () => localRole
  );

  // Network event bindings
  network.on("room_info", (info) => {
    ui.showSlotModal(info.slots);
  });

  network.on("join_result", (result) => {
    if (result.ok) {
      localRole = result.role;
      ui.localRole = result.role;
      ui.localToken = result.token;
      localStorage.setItem("gk_player_role", result.role);
      localStorage.setItem("gk_player_token", result.token);

      const joinModal = document.getElementById("joinModal");
      const charModal = document.getElementById("charModal");
      if (joinModal) joinModal.style.display = "none";
      if (charModal) charModal.style.display = "none";
    }
  });

  network.on("room_snapshot", (state) => {
    currentRoomState = state;
    ui.updateHUD(state);
  });

  network.on("task_catalog", (tasks) => {
    if (Array.isArray(tasks) && tasks.length > 0) {
      ui.tasks = tasks;
    }
  });

  network.on("player_moved", (data) => {
    if (!currentRoomState || !currentRoomState.players) return;
    const player = currentRoomState.players[data.role];
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.direction = data.direction;
      player.anim = data.anim;
    }
  });

  network.on("tiger_moved", (data) => {
    if (!currentRoomState) return;
    if (!currentRoomState.tiger) currentRoomState.tiger = {};
    currentRoomState.tiger.x = data.x;
    currentRoomState.tiger.y = data.y;
    currentRoomState.tiger.direction = data.direction;
    currentRoomState.tiger.anim = data.anim;
    currentRoomState.tiger.isOutside = data.isOutside;
  });

  network.on("task_started", (data) => {
    if (!currentRoomState || !currentRoomState.players) return;
    const roles = data.participants || [data.role];
    for (const r of roles) {
      if (currentRoomState.players[r]) {
        currentRoomState.players[r].activeTask = data.activeTask;
        currentRoomState.players[r].anim = "work";
      }
    }
  });

  network.on("task_completed", (data) => {
    if (!currentRoomState) return;
    if (data.stats) currentRoomState.stats = data.stats;
    if (data.objects) currentRoomState.objects = data.objects;
    if (data.players) currentRoomState.players = data.players;
    if (data.participants) {
      for (const r of data.participants) {
        if (currentRoomState.players[r]) {
          currentRoomState.players[r].activeTask = null;
          currentRoomState.players[r].anim = "idle";
        }
      }
    }
    if (data.distress && localRole && currentRoomState.players[localRole]) {
      currentRoomState.players[localRole].distress = data.distress;
      currentRoomState.players[localRole].isSick = Boolean(data.distress && data.distress.active);
    }
    ui.updateHUD(currentRoomState);
  });

  network.on("player_distress", (data) => {
    if (!currentRoomState || !currentRoomState.players) return;
    if (currentRoomState.players[data.role]) {
      currentRoomState.players[data.role].distress = data.distress;
      currentRoomState.players[data.role].isSick = Boolean(data.distress && data.distress.active);
    }
    ui.updateHUD(currentRoomState);
  });

  network.on("task_cancelled", (data) => {
    if (!currentRoomState || !currentRoomState.players) return;
    if (currentRoomState.players[data.role]) {
      currentRoomState.players[data.role].activeTask = null;
      currentRoomState.players[data.role].anim = "idle";
    }
  });

  network.on("chat_message", (data) => {
    if (!currentRoomState || !currentRoomState.players) return;
    if (data.bubble && currentRoomState.players[data.bubble.role]) {
      currentRoomState.players[data.bubble.role].bubble = {
        text: data.bubble.text,
        expiresAt: Date.now() + 5000
      };
    }
    const historyBox = document.getElementById("chatHistoryBox");
    if (historyBox && data.message) {
      const msgDiv = document.createElement("div");
      msgDiv.className = `chat-bubble-msg chat-msg-${data.message.role}`;
      const name = data.message.role === "karip" ? "Karip" : "Gabin";
      msgDiv.innerHTML = `<strong style="font-size: 0.76rem; display: block; opacity: 0.85;">${name}</strong>${data.message.text}`;
      historyBox.appendChild(msgDiv);
      historyBox.scrollTop = historyBox.scrollHeight;
    }
  });

  network.on("bubble_cleared", (data) => {
    if (!currentRoomState || !currentRoomState.players) return;
    if (currentRoomState.players[data.role]) {
      currentRoomState.players[data.role].bubble = null;
    }
  });

  network.on("error", (err) => {
    alert(err.message || "Terjadi kesalahan koneksi");
  });

  // Reset Camera View button - center directly on avatar
  const btnResetView = document.getElementById("btnResetView");
  if (btnResetView) {
    btnResetView.addEventListener("click", () => {
      const player = currentRoomState && currentRoomState.players && localRole ? currentRoomState.players[localRole] : null;
      renderer.resetCamera(player);
    });
  }
  // Highlight target object on canvas
  window.addEventListener("gk:highlight-object", (e) => {
    renderer.highlightedObjectId = e.detail.objectId;
    setTimeout(() => { renderer.highlightedObjectId = null; }, 6000);
  });

  // Canvas clicked on interactive object
  window.addEventListener("gk:canvas-clicked", (e) => {
    if (!currentRoomState || !currentRoomState.objects) return;
    const { x, y } = e.detail;
    for (const obj of Object.values(currentRoomState.objects)) {
      if (x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h) {
        ui.openTaskSelection(obj.id, obj.name);
        break;
      }
    }
  });

  // Connect network
  network.connect();

  // Main Render Loop
  function gameLoop() {
    renderer.render(currentRoomState, localRole);
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
})();
