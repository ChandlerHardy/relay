import { create } from "zustand";
import type { Session, Project, Assignment } from "./types";
import { fetchSessions, fetchSessionOutput, fetchProjects, fetchAssignments } from "./lib/api";

interface RelayStore {
  // State
  sessions: Session[];
  activeSessionId: string | null;
  outputBuffers: Record<string, string>;
  projects: Project[];
  assignments: Assignment[];
  activeAssignmentId: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadAssignments: () => Promise<void>;
  selectSession: (id: string | null) => void;
  selectAssignment: (id: string | null) => void;
  addSession: (session: Session) => void;
  addOutput: (sessionId: string, data: string) => void;
  updateSessionStatus: (
    sessionId: string,
    status: string,
    exitCode: number | null,
  ) => void;
  updateAssignment: (assignment: Assignment) => void;
}

export const useStore = create<RelayStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  outputBuffers: {},
  projects: [],
  assignments: [],
  activeAssignmentId: null,

  loadSessions: async () => {
    const sessions = await fetchSessions();
    const buffers: Record<string, string> = {};
    for (const s of sessions) {
      const output = await fetchSessionOutput(s.id);
      buffers[s.id] = output;
    }
    set({ sessions, outputBuffers: { ...get().outputBuffers, ...buffers } });
  },

  loadProjects: async () => {
    const projects = await fetchProjects();
    set({ projects });
  },

  loadAssignments: async () => {
    const assignments = await fetchAssignments();
    set({ assignments });
  },

  selectSession: (id) => set({ activeSessionId: id, activeAssignmentId: null }),

  selectAssignment: (id) => set({ activeAssignmentId: id, activeSessionId: null }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      outputBuffers: { ...state.outputBuffers, [session.id]: "" },
    })),

  addOutput: (sessionId, data) =>
    set((state) => ({
      outputBuffers: {
        ...state.outputBuffers,
        [sessionId]: (state.outputBuffers[sessionId] || "") + data,
      },
    })),

  updateSessionStatus: (sessionId, status, exitCode) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, status: status as Session["status"], exitCode }
          : s,
      ),
    })),

  updateAssignment: (assignment) =>
    set((state) => ({
      assignments: state.assignments.some((a) => a.id === assignment.id)
        ? state.assignments.map((a) => (a.id === assignment.id ? assignment : a))
        : [...state.assignments, assignment],
    })),
}));
