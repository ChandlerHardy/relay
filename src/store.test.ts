import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./store";

describe("RelayStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useStore.setState({
      sessions: [],
      activeSessionId: null,
      outputBuffers: {},
      projects: [],
    });
  });

  it("should start with empty state", () => {
    const state = useStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.activeSessionId).toBeNull();
    expect(state.outputBuffers).toEqual({});
    expect(state.projects).toEqual([]);
  });

  it("should add and select sessions", () => {
    const mockSession = {
      id: "test-1",
      projectDir: "/tmp/test",
      prompt: "test prompt",
      status: "running" as const,
      outputLength: 0,
      createdAt: new Date().toISOString(),
      exitCode: null,
      context: null,
    };

    useStore.getState().addSession(mockSession);
    expect(useStore.getState().sessions).toHaveLength(1);
    expect(useStore.getState().outputBuffers["test-1"]).toBe("");

    useStore.getState().selectSession("test-1");
    expect(useStore.getState().activeSessionId).toBe("test-1");
  });

  it("should accumulate output", () => {
    const mockSession = {
      id: "test-1",
      projectDir: "/tmp/test",
      prompt: "test prompt",
      status: "running" as const,
      outputLength: 0,
      createdAt: new Date().toISOString(),
      exitCode: null,
      context: null,
    };

    useStore.getState().addSession(mockSession);
    useStore.getState().addOutput("test-1", "hello ");
    useStore.getState().addOutput("test-1", "world");
    expect(useStore.getState().outputBuffers["test-1"]).toBe("hello world");
  });

  it("should update session status", () => {
    const mockSession = {
      id: "test-1",
      projectDir: "/tmp/test",
      prompt: "test prompt",
      status: "running" as const,
      outputLength: 0,
      createdAt: new Date().toISOString(),
      exitCode: null,
      context: null,
    };

    useStore.getState().addSession(mockSession);
    useStore.getState().updateSessionStatus("test-1", "completed", 0);
    const session = useStore
      .getState()
      .sessions.find((s) => s.id === "test-1");
    expect(session?.status).toBe("completed");
    expect(session?.exitCode).toBe(0);
  });

  it("should deselect session", () => {
    useStore.getState().selectSession("test-1");
    expect(useStore.getState().activeSessionId).toBe("test-1");

    useStore.getState().selectSession(null);
    expect(useStore.getState().activeSessionId).toBeNull();
  });
});
