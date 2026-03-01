import { createServer } from "http";
import { readFile, readdir, writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import {
  loadAssignments, saveAssignments, createAssignment as makeAssignment,
  getAssignment, getAllAssignments, getEligibleTasks,
} from "./assignments.ts";
import { planAssignment, evaluateSession, summarizeAssignment, buildTaskPrompt } from "./orchestrator.ts";

const PORT = 3847;
const REPOS_DIR = join(homedir(), "repos");
const DIST_DIR = join(import.meta.dirname, "dist");
const DATA_DIR = join(homedir(), ".relay");
const SESSIONS_FILE = join(DATA_DIR, "sessions.json");
const SKILLS_DIR = join(homedir(), ".claude", "skills");
const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

interface Session {
  id: string;
  projectDir: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  output: string[];
  ptyProcess: pty.IPty | null;
  createdAt: string;
  exitCode: number | null;
  context: ProjectContext | null;
  assignmentId?: string;
  taskId?: string;
  role?: "research" | "implement" | "review";
}

const sessions = new Map<string, Session>();
const wsClients = new Set<WebSocket>();

interface PersistedSession {
  id: string;
  projectDir: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  output: string[];
  createdAt: string;
  exitCode: number | null;
  context: ProjectContext | null;
  assignmentId?: string;
  taskId?: string;
  role?: "research" | "implement" | "review";
}

async function saveSessions() {
  const data: PersistedSession[] = [...sessions.values()].map((s) => ({
    id: s.id,
    projectDir: s.projectDir,
    prompt: s.prompt,
    status: s.status === "running" ? "failed" : s.status, // running sessions can't survive restart
    output: s.output,
    createdAt: s.createdAt,
    exitCode: s.exitCode,
    context: s.context,
    assignmentId: s.assignmentId,
    taskId: s.taskId,
    role: s.role,
  }));
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

async function loadSessions() {
  try {
    const raw = await readFile(SESSIONS_FILE, "utf-8");
    const data: PersistedSession[] = JSON.parse(raw);
    for (const s of data) {
      sessions.set(s.id, {
        ...s,
        context: s.context ?? null,
        ptyProcess: null,
        assignmentId: s.assignmentId ?? undefined,
        taskId: s.taskId ?? undefined,
        role: s.role ?? undefined,
      });
    }
    console.log(`  loaded ${data.length} saved session(s)`);
  } catch {
    // no saved sessions yet
  }
}

function broadcast(data: unknown) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function serializeSession(s: Session) {
  return {
    id: s.id,
    projectDir: s.projectDir,
    prompt: s.prompt,
    status: s.status,
    outputLength: s.output.length,
    createdAt: s.createdAt,
    exitCode: s.exitCode,
    context: s.context,
    assignmentId: s.assignmentId,
    taskId: s.taskId,
    role: s.role,
  };
}

function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\x1b\[<[a-zA-Z]/g, "")
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\]0;[^\x07\x1b]*/g, "")
    .replace(/\]9;[^\x07\x1b]*/g, "");
}

interface SkillInfo {
  name: string;
  description: string;
}

async function parseSkills(): Promise<SkillInfo[]> {
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills: SkillInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      let description = "";
      try {
        const files = await readdir(join(SKILLS_DIR, name));
        const mdFile = files.find((f) => f.endsWith(".md"));
        if (mdFile) {
          const content = await readFile(join(SKILLS_DIR, name, mdFile), "utf-8");
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
            if (descMatch) description = descMatch[1].trim();
          }
        }
      } catch {}
      skills.push({ name, description });
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

interface ConfigSummary {
  hooksCount: number;
  hooks: string[];
}

interface ProjectContext {
  claudeMd: string | null;
  skills: SkillInfo[];
  config: ConfigSummary;
}

async function parseConfig(): Promise<ConfigSummary> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings.hooks ? Object.keys(settings.hooks) : [];
    return { hooksCount: hooks.length, hooks };
  } catch {
    return { hooksCount: 0, hooks: [] };
  }
}

let cachedSkills: SkillInfo[] | null = null;
let cachedConfig: ConfigSummary | null = null;

function createSession(projectDir: string, prompt: string, context: ProjectContext | null): Session {
  const id = randomUUID();
  const session: Session = {
    id,
    projectDir,
    prompt,
    status: "running",
    output: [],
    ptyProcess: null,
    createdAt: new Date().toISOString(),
    exitCode: null,
    context,
  };

  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== "CLAUDECODE" && k !== "CLAUDE_CODE") {
      cleanEnv[k] = v;
    }
  }
  cleanEnv.FORCE_COLOR = "0";
  cleanEnv.TERM = "dumb";

  const claudePath =
    process.env.CLAUDE_PATH || join(homedir(), ".local", "bin", "claude");

  const ptyProc = pty.spawn(
    claudePath,
    ["-p", prompt, "--output-format", "text"],
    {
      name: "dumb",
      cols: 120,
      rows: 40,
      cwd: projectDir,
      env: cleanEnv,
    }
  );

  session.ptyProcess = ptyProc;

  ptyProc.onData((data: string) => {
    const clean = stripAnsi(data);
    if (clean.trim()) {
      session.output.push(clean);
      broadcast({ type: "output", sessionId: id, data: clean });
    }
  });

  ptyProc.onExit(({ exitCode }: { exitCode: number }) => {
    session.status = exitCode === 0 ? "completed" : "failed";
    session.exitCode = exitCode;
    session.ptyProcess = null;
    broadcast({
      type: "status",
      sessionId: id,
      status: session.status,
      exitCode,
    });
    saveSessions();

    // If this session belongs to an assignment, evaluate it
    if (session.assignmentId && session.taskId) {
      handleSessionCompletion(session).catch(err =>
        console.error("[orchestrator] handleSessionCompletion error:", err)
      );
    }
  });

  sessions.set(id, session);
  saveSessions();
  return session;
}

// --- Assignment orchestration ---

async function getProjectContext(projectDir: string): Promise<ProjectContext> {
  let claudeMd: string | null = null;
  try {
    claudeMd = await readFile(join(projectDir, "CLAUDE.md"), "utf-8");
  } catch {}
  if (!cachedSkills) cachedSkills = await parseSkills();
  if (!cachedConfig) cachedConfig = await parseConfig();
  return { claudeMd, skills: cachedSkills, config: cachedConfig };
}

function broadcastAssignmentUpdate(assignment: ReturnType<typeof getAllAssignments>[number]) {
  broadcast({ type: "assignment_update", assignment });
}

async function advanceAssignment(assignmentId: string) {
  const assignment = getAssignment(assignmentId);
  if (!assignment || assignment.status !== "active") return;

  const eligible = getEligibleTasks(assignment);
  const context = await getProjectContext(assignment.projectDir);

  for (const task of eligible) {
    task.status = "active";
    const prompt = buildTaskPrompt(task);
    const session = createSession(assignment.projectDir, prompt, context);
    session.assignmentId = assignmentId;
    session.taskId = task.id;
    session.role = task.role;
    task.sessionIds.push(session.id);
  }

  await saveAssignments();
  await saveSessions();
  broadcastAssignmentUpdate(assignment);
}

async function handleSessionCompletion(session: Session) {
  const assignment = getAssignment(session.assignmentId!);
  if (!assignment) return;

  const task = assignment.tasks.find(t => t.id === session.taskId);
  if (!task) return;

  const output = session.output.join("");

  try {
    const result = await evaluateSession(task, output, assignment);

    if (result.verdict === "pass") {
      task.status = "completed";
      task.evaluation = result.reasoning;
    } else if (result.verdict === "retry" && task.retryCount < 2) {
      task.status = "retrying";
      task.retryCount++;
      const retryPrompt = result.adjustedPrompt || buildTaskPrompt(task);
      const context = await getProjectContext(assignment.projectDir);
      const newSession = createSession(assignment.projectDir, retryPrompt, context);
      newSession.assignmentId = assignment.id;
      newSession.taskId = task.id;
      newSession.role = task.role;
      task.sessionIds.push(newSession.id);
    } else {
      task.status = "failed";
      task.evaluation = result.reasoning;
    }
  } catch (err) {
    console.error("[orchestrator] evaluation failed:", err);
    // If evaluation itself fails, mark based on exit code
    task.status = session.exitCode === 0 ? "completed" : "failed";
    task.evaluation = "Evaluation unavailable";
  }

  // Check assignment completion
  const allDone = assignment.tasks.every(t => t.status === "completed");
  const anyFailed = assignment.tasks.some(t => t.status === "failed");

  if (allDone) {
    try {
      assignment.summary = await summarizeAssignment(assignment);
    } catch {
      assignment.summary = "Assignment completed.";
    }
    assignment.status = "completed";
    assignment.completedAt = new Date().toISOString();
  } else if (!anyFailed) {
    await advanceAssignment(assignment.id);
  }
  // If some tasks failed but others can still proceed, advanceAssignment handles it

  await saveAssignments();
  broadcastAssignmentUpdate(assignment);
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);

  // API: list projects
  if (url.pathname === "/api/projects" && req.method === "GET") {
    try {
      const entries = await readdir(REPOS_DIR, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: join(REPOS_DIR, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(dirs));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
    }
    return;
  }

  // API: project context (CLAUDE.md, skills, config)
  const contextMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/context$/);
  if (contextMatch && req.method === "GET") {
    const projectName = decodeURIComponent(contextMatch[1]);
    const projectPath = join(REPOS_DIR, projectName);

    let claudeMd: string | null = null;
    try {
      claudeMd = await readFile(join(projectPath, "CLAUDE.md"), "utf-8");
    } catch {}

    if (!cachedSkills) cachedSkills = await parseSkills();
    if (!cachedConfig) cachedConfig = await parseConfig();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      claudeMd,
      skills: cachedSkills,
      config: cachedConfig,
    }));
    return;
  }

  // API: list sessions
  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const list = [...sessions.values()].map(serializeSession);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(list));
    return;
  }

  // API: create session
  if (url.pathname === "/api/sessions" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body) as {
      projectDir?: string;
      prompt?: string;
      context?: ProjectContext | null;
    };
    if (!parsed.projectDir || !parsed.prompt) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "projectDir and prompt required" }));
      return;
    }
    const session = createSession(parsed.projectDir, parsed.prompt, parsed.context ?? null);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(serializeSession(session)));
    return;
  }

  // API: get session output
  const outputMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/output$/);
  if (outputMatch && req.method === "GET") {
    const session = sessions.get(outputMatch[1]);
    if (!session) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output: session.output.join("") }));
    return;
  }

  // API: kill session
  const killMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (killMatch && req.method === "DELETE") {
    const session = sessions.get(killMatch[1]);
    if (!session) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    if (session.ptyProcess) session.ptyProcess.kill();
    session.status = "failed";
    session.ptyProcess = null;
    broadcast({ type: "status", sessionId: killMatch[1], status: "failed" });
    saveSessions();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // API: list assignments
  if (url.pathname === "/api/assignments" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getAllAssignments()));
    return;
  }

  // API: create assignment
  if (url.pathname === "/api/assignments" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body) as {
      goal?: string;
      projectDir?: string;
      autonomyLevel?: "autonomous" | "available";
    };
    if (!parsed.goal || !parsed.projectDir) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "goal and projectDir required" }));
      return;
    }
    const assignment = makeAssignment(
      parsed.goal,
      parsed.projectDir,
      parsed.autonomyLevel ?? "autonomous",
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(assignment));

    // Async: plan and start the assignment
    (async () => {
      try {
        const context = await getProjectContext(assignment.projectDir);
        assignment.tasks = await planAssignment(assignment, context);
        assignment.status = "active";
        await saveAssignments();
        broadcastAssignmentUpdate(assignment);
        await advanceAssignment(assignment.id);
      } catch (err) {
        console.error("[orchestrator] planning failed:", err);
        assignment.status = "failed";
        await saveAssignments();
        broadcastAssignmentUpdate(assignment);
      }
    })();
    return;
  }

  // API: get assignment detail
  const assignmentDetailMatch = url.pathname.match(/^\/api\/assignments\/([^/]+)$/);
  if (assignmentDetailMatch && req.method === "GET") {
    const assignment = getAssignment(assignmentDetailMatch[1]);
    if (!assignment) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(assignment));
    return;
  }

  // API: cancel assignment
  if (assignmentDetailMatch && req.method === "DELETE") {
    const assignment = getAssignment(assignmentDetailMatch[1]);
    if (!assignment) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    assignment.status = "failed";
    // Kill any running sessions for this assignment
    for (const task of assignment.tasks) {
      if (task.status === "active") {
        task.status = "failed";
        for (const sid of task.sessionIds) {
          const s = sessions.get(sid);
          if (s?.ptyProcess) s.ptyProcess.kill();
        }
      }
    }
    await saveAssignments();
    broadcastAssignmentUpdate(assignment);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // API: toggle autonomy level
  const autonomyMatch = url.pathname.match(/^\/api\/assignments\/([^/]+)\/autonomy$/);
  if (autonomyMatch && req.method === "PATCH") {
    const assignment = getAssignment(autonomyMatch[1]);
    if (!assignment) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body) as { autonomyLevel?: "autonomous" | "available" };
    if (parsed.autonomyLevel) {
      assignment.autonomyLevel = parsed.autonomyLevel;
      await saveAssignments();
      broadcastAssignmentUpdate(assignment);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(assignment));
    return;
  }

  // API: resolve a decision
  const decisionMatch = url.pathname.match(/^\/api\/assignments\/([^/]+)\/decisions\/([^/]+)$/);
  if (decisionMatch && req.method === "POST") {
    const assignment = getAssignment(decisionMatch[1]);
    if (!assignment) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const decision = assignment.decisions.find(d => d.id === decisionMatch[2]);
    if (!decision) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "decision not found" }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body) as { resolution?: string };
    if (!parsed.resolution) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "resolution required" }));
      return;
    }
    decision.status = "resolved";
    decision.resolution = parsed.resolution;
    decision.resolvedBy = "user";
    decision.resolvedAt = new Date().toISOString();
    await saveAssignments();
    broadcastAssignmentUpdate(assignment);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(assignment));
    return;
  }

  // Static files
  const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const fullPath = join(DIST_DIR, filePath);
  try {
    const data = await readFile(fullPath);
    const mime = MIME[extname(fullPath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
});

loadSessions().then(async () => {
  await loadAssignments();
  httpServer.listen(PORT, () => {
    console.log(`  relay running at http://localhost:${PORT}\n`);
  });
});
