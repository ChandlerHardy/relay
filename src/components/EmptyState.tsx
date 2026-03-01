import { useStore } from "../store";

export default function EmptyState() {
  const activeSessionId = useStore((s) => s.activeSessionId);

  if (activeSessionId) return null;

  return (
    <div id="empty-state">
      <p>No session selected</p>
      <p className="dim">Click + to spawn a new Claude Code session</p>
    </div>
  );
}
