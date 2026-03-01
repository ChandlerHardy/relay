import { useStore } from "../store";
import type { Assignment } from "../types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: Assignment["status"] }) {
  const colors: Record<Assignment["status"], string> = {
    planning: "var(--yellow)",
    active: "var(--accent)",
    completed: "var(--green)",
    failed: "var(--red)",
  };
  const color = colors[status];
  return (
    <span
      className="assignment-status-badge"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {status}
    </span>
  );
}

function taskProgress(tasks: Assignment["tasks"]): string {
  const completed = tasks.filter((t) => t.status === "completed").length;
  return `${completed}/${tasks.length} tasks`;
}

export default function AssignmentList() {
  const assignments = useStore((s) => s.assignments);
  const activeAssignmentId = useStore((s) => s.activeAssignmentId);
  const selectAssignment = useStore((s) => s.selectAssignment);

  if (assignments.length === 0) return null;

  return (
    <ul className="assignment-list">
      {assignments.map((assignment) => (
        <li
          key={assignment.id}
          className={`assignment-item${assignment.id === activeAssignmentId ? " active" : ""}`}
          onClick={() => selectAssignment(assignment.id)}
        >
          <span className="assignment-goal">
            {assignment.goal.length > 60
              ? assignment.goal.slice(0, 60) + "..."
              : assignment.goal}
          </span>
          <span className="assignment-meta">
            <StatusBadge status={assignment.status} />
            <span>{taskProgress(assignment.tasks)}</span>
            <span>{timeAgo(assignment.createdAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
