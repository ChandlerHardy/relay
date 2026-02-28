import { createServer } from "http";
import { readFile, readdir, writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";

const PORT = 3847;
const REPOS_DIR = join(homedir(), "repos");
const PUBLIC_DIR = join(import.meta.dirname, "public");
const DATA_DIR = join(homedir(), ".relay");
const SESSIONS_FILE = join(DATA_DIR, "sessions.json");

interface Session {
  id: string;
  projectDir: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  output: string[];
  ptyProcess: pty.IPty | null;
  createdAt: string;
  exitCode: number | null;
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
        ptyProcess: null,
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

function createSession(projectDir: string, prompt: string): Session {
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
  });

  sessions.set(id, session);
  saveSessions();
  return session;
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
    };
    if (!parsed.projectDir || !parsed.prompt) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "projectDir and prompt required" }));
      return;
    }
    const session = createSession(parsed.projectDir, parsed.prompt);
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

  // Static files
  const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const fullPath = join(PUBLIC_DIR, filePath);
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

loadSessions().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`  relay running at http://localhost:${PORT}\n`);
  });
});
