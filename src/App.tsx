import { useEffect } from "react";
import { useStore } from "./store";
import { connectWebSocket } from "./lib/ws";
import SessionList from "./components/SessionList";
import SessionView from "./components/SessionView";
import NewSessionDialog from "./components/NewSessionDialog";
import AssignmentList from "./components/AssignmentList";
import AssignmentView from "./components/AssignmentView";
import NewAssignmentDialog from "./components/NewAssignmentDialog";
import EmptyState from "./components/EmptyState";
import "./styles/global.css";

export default function App() {
  const {
    loadSessions,
    loadProjects,
    loadAssignments,
    addOutput,
    updateSessionStatus,
    updateAssignment,
  } = useStore();

  const activeSessionId = useStore((s) => s.activeSessionId);
  const activeAssignmentId = useStore((s) => s.activeAssignmentId);

  useEffect(() => {
    loadSessions();
    loadProjects();
    loadAssignments();
    connectWebSocket({
      onOutput: (sessionId, data) => addOutput(sessionId, data),
      onStatus: (sessionId, status, exitCode) =>
        updateSessionStatus(sessionId, status, exitCode),
      onAssignmentUpdate: (assignment) => updateAssignment(assignment),
    });
  }, []);

  const showEmptyState = !activeSessionId && !activeAssignmentId;

  return (
    <div id="app">
      <aside id="sidebar">
        <div className="sidebar-header">
          <h1>relay</h1>
          <div className="sidebar-header-actions">
            <NewAssignmentDialog />
            <NewSessionDialog />
          </div>
        </div>
        <div className="sidebar-section-label">Assignments</div>
        <AssignmentList />
        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Sessions</div>
        <SessionList />
      </aside>
      <main id="main">
        {showEmptyState && <EmptyState />}
        {activeAssignmentId && <AssignmentView />}
        {activeSessionId && <SessionView />}
      </main>
    </div>
  );
}
