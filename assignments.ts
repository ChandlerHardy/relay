import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";

const DATA_DIR = join(homedir(), ".relay");
const ASSIGNMENTS_FILE = join(DATA_DIR, "assignments.json");

export interface Decision {
  id: string;
  question: string;
  options: string[];
  context: string;
  status: "pending" | "resolved";
  resolution: string | null;
  resolvedBy: "user" | "pm" | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Task {
  id: string;
  description: string;
  role: "research" | "implement" | "review";
  status: "pending" | "active" | "completed" | "failed" | "retrying";
  dependencies: string[];  // task IDs
  sessionIds: string[];
  evaluation: string | null;
  prompt: string | null;  // PM-generated prompt for Claude Code
  retryCount: number;
}

export interface Assignment {
  id: string;
  goal: string;
  projectDir: string;
  status: "planning" | "active" | "completed" | "failed";
  autonomyLevel: "autonomous" | "available";
  tasks: Task[];
  decisions: Decision[];
  createdAt: string;
  completedAt: string | null;
  summary: string | null;
}

const assignments = new Map<string, Assignment>();

export async function saveAssignments(): Promise<void> {
  const data = [...assignments.values()];
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ASSIGNMENTS_FILE, JSON.stringify(data, null, 2));
}

export async function loadAssignments(): Promise<void> {
  try {
    const raw = await readFile(ASSIGNMENTS_FILE, "utf-8");
    const data: Assignment[] = JSON.parse(raw);
    for (const a of data) {
      assignments.set(a.id, a);
    }
    console.log(`  loaded ${data.length} saved assignment(s)`);
  } catch {
    // no saved assignments yet
  }
}

export function getAssignment(id: string): Assignment | undefined {
  return assignments.get(id);
}

export function getAllAssignments(): Assignment[] {
  return [...assignments.values()];
}

export function createAssignment(goal: string, projectDir: string, autonomyLevel: "autonomous" | "available"): Assignment {
  const assignment: Assignment = {
    id: randomUUID(),
    goal,
    projectDir,
    status: "planning",
    autonomyLevel,
    tasks: [],
    decisions: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    summary: null,
  };
  assignments.set(assignment.id, assignment);
  return assignment;
}

export function getEligibleTasks(assignment: Assignment): Task[] {
  return assignment.tasks.filter(t => {
    if (t.status !== "pending") return false;
    return t.dependencies.every(depId => {
      const dep = assignment.tasks.find(d => d.id === depId);
      return dep?.status === "completed";
    });
  });
}
