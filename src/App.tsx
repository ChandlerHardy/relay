import { useEffect } from "react";
import { useStore } from "./store";
import { connectWebSocket } from "./lib/ws";
import SessionList from "./components/SessionList";
import SessionView from "./components/SessionView";
import NewSessionDialog from "./components/NewSessionDialog";
import EmptyState from "./components/EmptyState";
import "./styles/global.css";

export default function App() {
  const { loadSessions, loadProjects, addOutput, updateSessionStatus } =
    useStore();

  useEffect(() => {
    loadSessions();
    loadProjects();
    connectWebSocket({
      onOutput: (sessionId, data) => addOutput(sessionId, data),
      onStatus: (sessionId, status, exitCode) =>
        updateSessionStatus(sessionId, status, exitCode),
    });
  }, []);

  return (
    <div id="app">
      <aside id="sidebar">
        <div className="sidebar-header">
          <h1>relay</h1>
          <NewSessionDialog />
        </div>
        <SessionList />
      </aside>
      <main id="main">
        <EmptyState />
        <SessionView />
      </main>
    </div>
  );
}
