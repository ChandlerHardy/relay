interface WSHandlers {
  onOutput: (sessionId: string, data: string) => void;
  onStatus: (
    sessionId: string,
    status: string,
    exitCode: number | null,
  ) => void;
}

export function connectWebSocket(handlers: WSHandlers): WebSocket {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "output") {
      handlers.onOutput(msg.sessionId, msg.data);
    }
    if (msg.type === "status") {
      handlers.onStatus(msg.sessionId, msg.status, msg.exitCode);
    }
  };

  ws.onclose = () => {
    // Reconnect after 2 seconds
    setTimeout(() => connectWebSocket(handlers), 2000);
  };

  return ws;
}
