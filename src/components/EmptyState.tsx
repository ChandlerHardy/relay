import { useStore } from "../store";

export default function EmptyState() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const activeAssignmentId = useStore((s) => s.activeAssignmentId);

  if (activeSessionId || activeAssignmentId) return null;

  return (
    <div id="empty-state">
      <p>Nothing selected</p>
      <p className="dim">Create an assignment or spawn a session to get started</p>
    </div>
  );
}
