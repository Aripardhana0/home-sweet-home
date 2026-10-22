"use strict";

class UIManager {
  constructor(network) {
    this.network = network;
    this.tasks = [];
    this.activeRoomId = null;
    this.localRole = null;
    this.localToken = null;

    this.loadTaskCatalog();
    this.setupDOMElements();
    this.setupListeners();
  }

  async loadTaskCatalog() {
    try {
      let res = await fetch("/api/tasks");
      if (!res.ok) {
        res = await fetch("/data/tasks.json");
      }
      if (res.ok) {
        this.tasks = await res.json();
      }
    } catch {
      // Fallback: tasks will be populated via WebSocket task_catalog event
    }
  }

  setupDOMElements() {
    this.joinModal = document.getElementById("joinModal");
    this.charModal = document.getElementById("charModal");
    this.taskModal = document.getElementById("taskModal");
    this.taskBoardModal = document.getElementById("taskBoardModal");
    this.taskBoardList = document.getElementById("taskBoardList");
    this.btnOpenTaskBoard = document.getElementById("btnOpenTaskBoard");
    this.coopBanner = document.getElementById("coopBanner");
    this.clockDisplay = document.getElementById("hudClock");
    this.dayDisplay = document.getElementById("hudDay");

    this.barEnergy = document.getElementById("barEnergy");
    this.barHunger = document.getElementById("barHunger");
    this.barMood = document.getElementById("barMood");
    this.barComfort = document.getElementById("barComfort");
    this.barHarmony = document.getElementById("barHarmony");

    this.taskListEl = document.getElementById("taskList");
    this.chatInput = document.getElementById("chatInput");
    this.btnSendChat = document.getElementById("btnSendChat");
    this.sickAlert = document.getElementById("sickAlertBanner");
  }

  setupListeners() {
    // Form Join Room
    const formJoin = document.getElementById("formJoin");
    if (formJoin) {
      formJoin.addEventListener("submit", (e) => {
        e.preventDefault();
        const codeInput = document.getElementById("inputRoomCode");
        const code = (codeInput ? codeInput.value : "").trim().toUpperCase();
        if (!code) return;

        localStorage.setItem("gk_room_code", code);
        const cachedRole = localStorage.getItem("gk_player_role");
        const cachedToken = localStorage.getItem("gk_player_token");

        // Ask room info first
        this.network.send("join_room", { code, role: cachedRole || null, token: cachedToken || null });
      });
    }

    // Character Card Selection
    const cardKarip = document.getElementById("cardKarip");
    const cardGabin = document.getElementById("cardGabin");

    if (cardKarip) {
      cardKarip.addEventListener("click", () => this.selectSlot("karip"));
    }
    if (cardGabin) {
      cardGabin.addEventListener("click", () => this.selectSlot("gabin"));
    }

    // Chat sending
    if (this.btnSendChat && this.chatInput) {
      this.btnSendChat.addEventListener("click", () => this.sendChat());
      this.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.sendChat();
      });
    }

    // Quick phrases chips
    document.querySelectorAll(".btn-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-phrase");
        if (text) {
          this.network.send("chat_send", { text });
        }
      });
    });

    // Emotes
    document.querySelectorAll(".btn-emote").forEach((btn) => {
      btn.addEventListener("click", () => {
        const emote = btn.getAttribute("data-emote");
        if (emote) {
          this.network.send("emote", { emoteId: emote });
        }
      });
    });

    // Custom event: open task modal for nearby object
    window.addEventListener("gk:open-tasks-for-object", (e) => {
      this.openTaskSelection(e.detail.objectId, e.detail.objectName);
    });

    // Close task modal
    const btnCloseTask = document.getElementById("btnCloseTask");
    if (btnCloseTask) {
      btnCloseTask.addEventListener("click", () => {
        this.taskModal.style.display = "none";
      });
    }

    // Open Task Board
    if (this.btnOpenTaskBoard) {
      this.btnOpenTaskBoard.addEventListener("click", () => this.openTaskBoard());
    }
    const btnCloseTaskBoard = document.getElementById("btnCloseTaskBoard");
    if (btnCloseTaskBoard) {
      btnCloseTaskBoard.addEventListener("click", () => {
        if (this.taskBoardModal) this.taskBoardModal.style.display = "none";
      });
    }
  }

  selectSlot(role) {
    const code = localStorage.getItem("gk_room_code");
    const token = localStorage.getItem("gk_player_token");
    this.network.send("join_room", { code, role, token });
  }

  sendChat() {
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.network.send("chat_send", { text });
    this.chatInput.value = "";
  }

  updateHUD(state) {
    if (!state) return;

    // Clock
    if (this.clockDisplay && typeof state.gameTimeMs === "number") {
      const totalSec = Math.floor(state.gameTimeMs / 1000);
      const hours = Math.floor(totalSec / 3600) % 24;
      const mins = Math.floor((totalSec % 3600) / 60);
      this.clockDisplay.textContent = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    }

    if (this.dayDisplay && state.day) {
      this.dayDisplay.textContent = `Hari ${state.day}`;
    }

    // Stats
    if (state.stats) {
      if (this.barEnergy) this.barEnergy.style.width = `${state.stats.energy}%`;
      if (this.barHunger) this.barHunger.style.width = `${state.stats.hunger}%`;
      if (this.barMood) this.barMood.style.width = `${state.stats.mood}%`;
      if (this.barComfort) this.barComfort.style.width = `${state.stats.homeComfort}%`;
      if (this.barHarmony) this.barHarmony.style.width = `${state.stats.harmony}%`;
    }

    // Active Co-op invite
    if (this.coopBanner) {
      if (state.activeInvite && state.activeInvite.toRole === this.localRole) {
        this.showCoopInvite(state.activeInvite);
      } else {
        this.coopBanner.style.display = "none";
      }
    }

    // Sick / Exhausted Alert Banner
    if (this.sickAlert) {
      const isSick = this.localRole && state.players && state.players[this.localRole] && state.players[this.localRole].isSick;
      this.sickAlert.style.display = isSick ? "block" : "none";
    }

  }
  showCoopInvite(invite) {
    const textEl = document.getElementById("coopText");
    if (textEl) {
      const partnerName = invite.fromRole === "karip" ? "Karip" : "Gabin";
      textEl.textContent = `${partnerName} mengajak Anda: ${invite.taskTitle}. Ikuti aktivitas ini bersama?`;
    }

    const btnAccept = document.getElementById("btnCoopAccept");
    const btnDecline = document.getElementById("btnCoopDecline");

    if (btnAccept) {
      btnAccept.onclick = () => {
        this.network.send("invite_accept", { inviteId: invite.id });
        this.coopBanner.style.display = "none";
      };
    }

    if (btnDecline) {
      btnDecline.onclick = () => {
        this.network.send("invite_decline", { inviteId: invite.id });
        this.coopBanner.style.display = "none";
      };
    }

    this.coopBanner.style.display = "flex";
  }

  showSlotModal(slots) {
    this.joinModal.style.display = "none";
    this.charModal.style.display = "flex";

    const cardKarip = document.getElementById("cardKarip");
    const cardGabin = document.getElementById("cardGabin");
    const statusKarip = document.getElementById("statusKarip");
    const statusGabin = document.getElementById("statusGabin");

    const savedToken = localStorage.getItem("gk_player_token");
    const savedRole = localStorage.getItem("gk_player_role");

    if (slots.karip.claimed) {
      if (savedRole === "karip" && savedToken) {
        statusKarip.textContent = "Lanjutkan Sesi";
        statusKarip.className = "card-status";
        cardKarip.classList.remove("disabled");
      } else {
        statusKarip.textContent = "Terisi";
        statusKarip.className = "card-status occupied";
        cardKarip.classList.add("disabled");
      }
    } else {
      statusKarip.textContent = "Tersedia";
      statusKarip.className = "card-status";
      cardKarip.classList.remove("disabled");
    }

    if (slots.gabin.claimed) {
      if (savedRole === "gabin" && savedToken) {
        statusGabin.textContent = "Lanjutkan Sesi";
        statusGabin.className = "card-status";
        cardGabin.classList.remove("disabled");
      } else {
        statusGabin.textContent = "Terisi";
        statusGabin.className = "card-status occupied";
        cardGabin.classList.add("disabled");
      }
    } else {
      statusGabin.textContent = "Tersedia";
      statusGabin.className = "card-status";
      cardGabin.classList.remove("disabled");
    }
  }

  openTaskSelection(objectId, objectName) {
    if (!this.taskModal) return;
    const titleEl = document.getElementById("taskModalTitle");
    const container = document.getElementById("taskModalList");
    if (!titleEl || !container) return;

    titleEl.textContent = `Aktivitas: ${objectName}`;
    container.innerHTML = "";

    const available = this.tasks.filter((t) => t.objectId === objectId);
    if (available.length === 0) {
      container.innerHTML = "<p style='color: var(--text-muted); font-size: 0.9rem;'>Tidak ada aktivitas yang dapat dikerjakan saat ini.</p>";
    } else {
      for (const t of available) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.padding = "10px 0";
        row.style.borderBottom = "1px solid var(--border-color)";

        const info = document.createElement("div");
        info.innerHTML = `<strong>${t.title}</strong><div style='font-size: 0.78rem; color: var(--text-muted);'>Durasi: ${t.durationMs / 1000}s | Mode: ${t.mode}</div>`;

        const btn = document.createElement("button");
        btn.className = "btn-chip";
        btn.textContent = t.mode === "co-op" ? "Ajak Pasangan" : "Mulai";

        btn.onclick = () => {
          if (t.mode === "co-op") {
            this.network.send("invite_action", { taskId: t.id });
          } else {
            this.network.send("task_start", { taskId: t.id });
          }
          this.taskModal.style.display = "none";
        };

        row.appendChild(info);
        row.appendChild(btn);
        container.appendChild(row);
      }
    }

    this.taskModal.style.display = "flex";
  }

  openTaskBoard() {
    if (!this.taskBoardModal || !this.taskBoardList) return;
    this.taskBoardList.innerHTML = "";

    if (this.tasks.length === 0) {
      this.taskBoardList.innerHTML = "<p style='color: var(--text-muted); padding: 12px;'>Memuat daftar tugas...</p>";
    } else {
      const areaNames = {
        bedroom: "Kamar Tidur Utama",
        bathroom: "Kamar Mandi & Spa",
        laundry: "Ruang Laundry",
        kitchen: "Dapur Modern & Makan",
        living: "Ruang Keluarga & Lounge",
        garden: "Teras & Kebun Bunga",
        pool: "Area Kolam Renang",
        tiger: "Kandang Macan (Si Belang)",
        any: "Di Mana Saja (Dekat Pasangan)"
      };

      for (const t of this.tasks) {
        const card = document.createElement("div");
        card.style.background = "var(--bg-card)";
        card.style.border = "1px solid var(--border-color)";
        card.style.borderRadius = "6px";
        card.style.padding = "10px 14px";
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.justifyContent = "space-between";
        card.style.gap = "12px";

        const isCoop = t.mode === "co-op";
        const modeBadge = isCoop
          ? `<span style="display: inline-block; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: #3d3012; color: var(--accent-gold); font-weight: bold;">[BERSAMA]</span>`
          : `<span style="display: inline-block; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: #123821; color: var(--accent-green); font-weight: bold;">[BISA SENDIRI]</span>`;

        const effectList = [];
        if (t.effects) {
          if (t.effects.energy) effectList.push(`+${t.effects.energy} Energi`);
          if (t.effects.hunger) effectList.push(`+${t.effects.hunger} Kenyang`);
          if (t.effects.mood) effectList.push(`+${t.effects.mood} Mood`);
          if (t.effects.homeComfort) effectList.push(`+${t.effects.homeComfort} Kenyamanan`);
          if (t.effects.harmony) effectList.push(`+${t.effects.harmony} Harmoni`);
        }
        const effectStr = effectList.length > 0 ? effectList.join(", ") : "Santai";
        const areaLabel = areaNames[t.area] || t.area;

        const left = document.createElement("div");
        left.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
            <strong style="color: var(--text-primary); font-size: 0.95rem;">${t.title}</strong>
            ${modeBadge}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            Lokasi: <span style="color: var(--text-secondary);">${areaLabel}</span> | Durasi: ${t.durationMs / 1000}s | Efek: ${effectStr}
          </div>
        `;

        const btn = document.createElement("button");
        btn.className = "btn-chip";
        btn.style.whiteSpace = "nowrap";
        btn.textContent = isCoop ? "Ajak Bersama" : "Kerjakan Tugas";
        btn.onclick = () => {
          if (isCoop) {
            this.network.send("invite_action", { taskId: t.id });
          } else {
            this.network.send("task_start", { taskId: t.id });
          }
          window.dispatchEvent(new CustomEvent("gk:highlight-object", { detail: { objectId: t.objectId } }));
          this.taskBoardModal.style.display = "none";
        };

        card.appendChild(left);
        card.appendChild(btn);
        this.taskBoardList.appendChild(card);
      }
    }

    this.taskBoardModal.style.display = "flex";
  }
}

window.UIManager = UIManager;
