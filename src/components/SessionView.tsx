import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { killSession } from "../lib/api";
import ContextPanel from "./ContextPanel";

export default function SessionView() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const outputBuffers = useStore((s) => s.outputBuffers);
  const loadSessions = useStore((s) => s.loadSessions);
  const outputRef = useRef<HTMLPreElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId);
  const output = activeSessionId ? outputBuffers[activeSessionId] || "" : "";

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  if (!session) return null;

  const handleKill = async () => {
    if (!activeSessionId) return;
    await killSession(activeSessionId);
    await loadSessions();
  };

  return (
    <div id="session-view">
      <div id="session-header">
        <div>
          <span className={`status-badge ${session.status}`}>
            {session.status}
          </span>
          <span className="dim">{session.projectDir}</span>
        </div>
        {session.status === "running" && (
          <button className="danger" title="Kill Session" onClick={handleKill}>
            Stop
          </button>
        )}
      </div>
      <div id="session-prompt">{session.prompt}</div>
      <ContextPanel context={session.context} variant="session" />
      <pre id="session-output" ref={outputRef}>
        {output}
      </pre>
    </div>
  );
}
