import { useState } from "react";
import { useStore } from "../store";
import {
  cancelAssignment,
  toggleAutonomy,
  resolveDecision,
} from "../lib/api";
import type { Assignment, Task, Decision } from "../types";

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
      className="status-badge"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: Task["role"] }) {
  const colors: Record<Task["role"], string> = {
    research: "#a371f7",
    implement: "var(--accent)",
    review: "var(--yellow)",
  };
  return (
    <span className="role-badge" style={{ color: colors[role] }}>
      {role}
    </span>
  );
}

function TaskStatusIcon({ status }: { status: Task["status"] }) {
  switch (status) {
    case "completed":
      return <span style={{ color: "var(--green)" }}>{"\u2713"}</span>;
    case "failed":
      return <span style={{ color: "var(--red)" }}>{"\u2717"}</span>;
    case "active":
      return <span className="running-indicator" />;
    case "retrying":
      return <span style={{ color: "var(--yellow)" }}>{"\u21BB"}</span>;
    default:
      return <span style={{ color: "var(--dim)" }}>{"\u25CB"}</span>;
  }
}

function TaskRow({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="task-row">
      <div className="task-row-main" onClick={() => setExpanded(!expanded)}>
        <TaskStatusIcon status={task.status} />
        <RoleBadge role={task.role} />
        <span className="task-description">{task.description}</span>
        {task.retryCount > 0 && (
          <span className="retry-count" title="Retry count">
            {"\u21BB"}{task.retryCount}
          </span>
        )}
        <span className="task-expand-icon">{expanded ? "\u25BE" : "\u25B8"}</span>
      </div>
      {expanded && (
        <div className="task-row-details">
          {task.evaluation && (
            <div className="task-evaluation">
              <span className="dim">Evaluation:</span> {task.evaluation}
            </div>
          )}
          {task.sessionIds.length > 0 && (
            <div className="task-sessions">
              <span className="dim">Sessions:</span>{" "}
              {task.sessionIds.map((sid) => (
                <code key={sid} className="session-id-link">
                  {sid.slice(0, 8)}
                </code>
              ))}
            </div>
          )}
          {!task.evaluation && task.sessionIds.length === 0 && (
            <div className="dim">No details yet</div>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionCard({
  decision,
  assignmentId,
}: {
  decision: Decision;
  assignmentId: string;
}) {
  const updateAssignment = useStore((s) => s.updateAssignment);
  const [resolving, setResolving] = useState(false);

  const handleResolve = async (option: string) => {
    setResolving(true);
    try {
      const updated = await resolveDecision(
        assignmentId,
        decision.id,
        option,
      );
      updateAssignment(updated);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="decision-card">
      <div className="decision-question">{decision.question}</div>
      {decision.context && (
        <div className="decision-context dim">{decision.context}</div>
      )}
      <div className="decision-options">
        {decision.options.map((option) => (
          <button
            key={option}
            onClick={() => handleResolve(option)}
            disabled={resolving}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AssignmentView() {
  const activeAssignmentId = useStore((s) => s.activeAssignmentId);
  const assignments = useStore((s) => s.assignments);
  const updateAssignment = useStore((s) => s.updateAssignment);
  const loadAssignments = useStore((s) => s.loadAssignments);

  const assignment = assignments.find((a) => a.id === activeAssignmentId);

  if (!assignment) return null;

  const completedTasks = assignment.tasks.filter(
    (t) => t.status === "completed",
  ).length;
  const totalTasks = assignment.tasks.length;
  const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const pendingDecisions = assignment.decisions.filter(
    (d) => d.status === "pending",
  );
  const isActive =
    assignment.status === "active" || assignment.status === "planning";

  const handleCancel = async () => {
    if (!activeAssignmentId) return;
    await cancelAssignment(activeAssignmentId);
    await loadAssignments();
  };

  const handleToggleAutonomy = async () => {
    if (!activeAssignmentId) return;
    const newLevel =
      assignment.autonomyLevel === "autonomous" ? "available" : "autonomous";
    const updated = await toggleAutonomy(activeAssignmentId, newLevel);
    updateAssignment(updated);
  };

  return (
    <div id="assignment-view">
      <div className="assignment-header">
        <div className="assignment-header-left">
          <StatusBadge status={assignment.status} />
          <span className="dim">{assignment.projectDir}</span>
        </div>
        <div className="assignment-header-right">
          {isActive && (
            <button className="autonomy-toggle" onClick={handleToggleAutonomy}>
              {assignment.autonomyLevel === "autonomous"
                ? "Autonomous"
                : "Available"}
            </button>
          )}
          {isActive && (
            <button className="danger" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="assignment-goal-section">{assignment.goal}</div>

      {totalTasks > 0 && (
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Task List */}
      <div className="assignment-section">
        <h3 className="section-title">
          Tasks
          <span className="dim">
            {" "}
            {completedTasks}/{totalTasks}
          </span>
        </h3>
        {assignment.tasks.length === 0 ? (
          <div className="dim" style={{ padding: "8px 0" }}>
            No tasks yet — planning in progress
          </div>
        ) : (
          assignment.tasks.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </div>

      {/* Decision Queue */}
      {pendingDecisions.length > 0 && (
        <div className="assignment-section">
          <h3 className="section-title">
            Pending Decisions
            <span className="dim"> {pendingDecisions.length}</span>
          </h3>
          {pendingDecisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              assignmentId={assignment.id}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {assignment.summary && (
        <div className="assignment-section">
          <h3 className="section-title">Summary</h3>
          <div className="assignment-summary">{assignment.summary}</div>
        </div>
      )}
    </div>
  );
}
