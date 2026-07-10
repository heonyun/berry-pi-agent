import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadContextCanvasEnv } from "./load-env.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const monorepoRoot = path.resolve(appRoot, "../..");
const devLogDir = path.join(monorepoRoot, ".orchestrator", "context-canvas-dev");
const apiLogPath = path.join(devLogDir, "api.log");

loadContextCanvasEnv(appRoot);

if (!process.env.CONTEXT_CANVAS_PROVIDER?.trim()) {
  process.env.CONTEXT_CANVAS_PROVIDER = "deepseek";
}
if (!process.env.CONTEXT_CANVAS_MODEL?.trim()) {
  process.env.CONTEXT_CANVAS_MODEL = "deepseek-v4-flash";
}

const deepseekKeyLoaded = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
console.log(`DEEPSEEK_API_KEY: ${deepseekKeyLoaded ? "loaded" : "not set"}`);
console.log(
  `Agent provider/model: ${process.env.CONTEXT_CANVAS_PROVIDER}/${process.env.CONTEXT_CANVAS_MODEL}`,
);
const contextCanvasToken = process.env.CONTEXT_CANVAS_TOKEN || crypto.randomBytes(32).toString("hex");
const bindHost = process.env.CONTEXT_CANVAS_BIND_HOST || "127.0.0.1";
const viteHost = process.env.CONTEXT_CANVAS_VITE_HOST || "127.0.0.1";

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    if (host) {
      server.listen(port, host);
    } else {
      server.listen(port);
    }
  });
}

async function findAvailablePort(startPort, host) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await canListen(port, host)) {
      return port;
    }
  }
  throw new Error(`No available Context Canvas API port found from ${startPort} to ${startPort + 99}.`);
}

function run(command, args, name, extraEnv = {}, options = {}) {
  const teeLogPath = options.teeLogPath;
  const child = spawn(command, args, {
    cwd: appRoot,
    stdio: teeLogPath ? ["inherit", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CONTEXT_CANVAS_TOKEN: contextCanvasToken,
      VITE_CONTEXT_CANVAS_TOKEN: contextCanvasToken,
      ...extraEnv,
    },
  });
  if (teeLogPath) {
    fs.mkdirSync(path.dirname(teeLogPath), { recursive: true });
    const logStream = fs.createWriteStream(teeLogPath, { flags: "a" });
    logStream.write(`\n--- dev server start ${new Date().toISOString()} ---\n`);
    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });
  }
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[${name}] exited via ${signal}`);
    } else if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

const apiPort = await findAvailablePort(Number(process.env.CONTEXT_CANVAS_PORT || 3001), bindHost);
const vitePort = await findAvailablePort(Number(process.env.CONTEXT_CANVAS_VITE_PORT || 5173), viteHost);
const apiTarget = `http://${bindHost}:${apiPort}`;
const allowedOrigins =
  process.env.CONTEXT_CANVAS_ALLOWED_ORIGINS ||
  Array.from(new Set([`http://${viteHost}:${vitePort}`, `http://localhost:${vitePort}`])).join(",");
console.log(`Context Canvas dev API target: ${apiTarget}`);
console.log(`Context Canvas dev allowed origins: ${allowedOrigins}`);
console.log(`Context Canvas dev API log: ${apiLogPath}`);

const server = run(
  "npx",
  ["tsx", "src/server/index.ts"],
  "server",
  {
    CONTEXT_CANVAS_ALLOWED_ORIGINS: allowedOrigins,
    CONTEXT_CANVAS_BIND_HOST: bindHost,
    CONTEXT_CANVAS_PORT: String(apiPort),
    CONTEXT_CANVAS_REQUEST_LOG: "1",
  },
  { teeLogPath: apiLogPath },
);
const vite = run("npx", ["vite", "--host", viteHost, "--port", String(vitePort), "--strictPort"], "vite", {
  CONTEXT_CANVAS_API_TARGET: apiTarget,
});

function shutdown() {
  server.kill();
  vite.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
