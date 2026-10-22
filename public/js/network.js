"use strict";

class NetworkClient {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isExplicitDisconnect = false;
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("connected", {});
    };

    this.ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data);
        if (envelope && envelope.type) {
          this.emit(envelope.type, envelope.payload, envelope);
        }
      } catch (err) {
        console.error("Failed to parse websocket frame", err);
      }
    };

    this.ws.onclose = () => {
      this.emit("disconnected", {});
      if (!this.isExplicitDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = (err) => {
      this.emit("error", err);
    };
  }

  send(type, payload = {}, requestId = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type,
        payload,
        requestId,
        timestamp: Date.now()
      }));
    }
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);
  }

  emit(type, payload, fullEnvelope) {
    const list = this.handlers.get(type);
    if (list) {
      for (const fn of list) {
        try {
          fn(payload, fullEnvelope);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

window.NetworkClient = NetworkClient;
