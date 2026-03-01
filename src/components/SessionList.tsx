import { useStore } from "../store";
import type { Session } from "../types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusDot({ status }: { status: Session["status"] }) {
  if (status === "running") {
    return <span className="running-indicator" />;
  }
  if (status === "completed") {
    return <span style={{ color: "var(--green)" }}>{"\u2713"}</span>;
  }
  return <span style={{ color: "var(--red)" }}>{"\u2717"}</span>;
}

export default function SessionList() {
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const selectSession = useStore((s) => s.selectSession);

  return (
    <ul id="session-list">
      {sessions.map((session) => (
        <li
          key={session.id}
          className={session.id === activeSessionId ? "active" : ""}
          onClick={() => selectSession(session.id)}
        >
          <span className="session-prompt-preview">
            {session.prompt.slice(0, 80)}
          </span>
          <span className="session-meta">
            <StatusDot status={session.status} />
            <span>{session.projectDir.split("/").pop()}</span>
            <span>{timeAgo(session.createdAt)}</span>
            {session.role && (
              <span className={`role-badge role-${session.role}`}>
                {session.role}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
