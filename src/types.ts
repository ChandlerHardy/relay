export interface SkillInfo {
  name: string;
  description: string;
}

export interface ConfigSummary {
  hooksCount: number;
  hooks: string[];
}

export interface ProjectContext {
  claudeMd: string | null;
  skills: SkillInfo[];
  config: ConfigSummary;
}

export interface Session {
  id: string;
  projectDir: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  outputLength: number;
  createdAt: string;
  exitCode: number | null;
  context: ProjectContext | null;
  // Future: assignment fields
  assignmentId?: string;
  taskId?: string;
  role?: "research" | "implement" | "review";
}

export interface Project {
  name: string;
  path: string;
}

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
  dependencies: string[];
  sessionIds: string[];
  evaluation: string | null;
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
