import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { randomUUID } from "crypto";

interface Session {
  id: string;
  projectDir: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  output: string[];
  process: ChildProcess | null;
  createdAt: string;
  exitCode: number | null;
}

const sessions = new Map<string, Session>();
const wsClients = new Set<ServerWebSocket<unknown>>();

type ServerWebSocket<T> = {
  send(data: string): void;
  close(): void;
  data: T;
};

function broadcast(data: unknown) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    try {
      ws.send(msg);
    } catch {
      wsClients.delete(ws);
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

function createSession(projectDir: string, prompt: string): Session {
  const id = randomUUID();
  const session: Session = {
    id,
    projectDir,
    prompt,
    status: "running",
    output: [],
    process: null,
    createdAt: new Date().toISOString(),
    exitCode: null,
  };

  const proc = spawn("claude", ["-p", prompt, "--output-format", "text"], {
    cwd: projectDir,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: true,
  });

  session.process = proc;

  proc.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    session.output.push(text);
    broadcast({ type: "output", sessionId: id, data: text });
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    session.output.push(text);
    broadcast({ type: "output", sessionId: id, data: text });
  });

  proc.on("close", (code: number | null) => {
    session.status = code === 0 ? "completed" : "failed";
    session.exitCode = code;
    session.process = null;
    broadcast({
      type: "status",
      sessionId: id,
      status: session.status,
      exitCode: code,
    });
  });

  proc.on("error", (err: Error) => {
    session.status = "failed";
    session.output.push(`Error: ${err.message}`);
    session.process = null;
    broadcast({
      type: "output",
      sessionId: id,
      data: `Error: ${err.message}`,
    });
    broadcast({ type: "status", sessionId: id, status: "failed" });
  });

  sessions.set(id, session);
  return session;
}

const server = Bun.serve({
  port: 3847,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // API: list sessions
    if (url.pathname === "/api/sessions" && req.method === "GET") {
      const list = [...sessions.values()].map(serializeSession);
      return Response.json(list);
    }

    // API: create session
    if (url.pathname === "/api/sessions" && req.method === "POST") {
      const body = (await req.json()) as {
        projectDir?: string;
        prompt?: string;
      };
      if (!body.projectDir || !body.prompt) {
        return Response.json(
          { error: "projectDir and prompt required" },
          { status: 400 }
        );
      }
      const session = createSession(body.projectDir, body.prompt);
      return Response.json(serializeSession(session));
    }

    // API: get session output
    if (
      url.pathname.match(/^\/api\/sessions\/[^/]+\/output$/) &&
      req.method === "GET"
    ) {
      const id = url.pathname.split("/")[3];
      const session = sessions.get(id);
      if (!session)
        return Response.json({ error: "not found" }, { status: 404 });
      return Response.json({ output: session.output.join("") });
    }

    // API: kill session
    if (
      url.pathname.match(/^\/api\/sessions\/[^/]+$/) &&
      req.method === "DELETE"
    ) {
      const id = url.pathname.split("/").pop()!;
      const session = sessions.get(id);
      if (!session)
        return Response.json({ error: "not found" }, { status: 404 });
      if (session.process) session.process.kill("SIGTERM");
      session.status = "failed";
      session.process = null;
      broadcast({ type: "status", sessionId: id, status: "failed" });
      return Response.json({ ok: true });
    }

    // Static files
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(import.meta.dir, "public", filePath));
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      wsClients.add(ws as unknown as ServerWebSocket<unknown>);
    },
    close(ws) {
      wsClients.delete(ws as unknown as ServerWebSocket<unknown>);
    },
    message() {},
  },
});

console.log(`\n  dispatch running at http://localhost:${server.port}\n`);
