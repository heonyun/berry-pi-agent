import { spawn } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const contextCanvasToken = process.env.CONTEXT_CANVAS_TOKEN || crypto.randomBytes(32).toString("hex");
const bindHost = process.env.CONTEXT_CANVAS_BIND_HOST || "127.0.0.1";

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, bindHost);
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }
  throw new Error(`No available Context Canvas API port found from ${startPort} to ${startPort + 99}.`);
}

function run(command, args, name, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: appRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CONTEXT_CANVAS_TOKEN: contextCanvasToken,
      VITE_CONTEXT_CANVAS_TOKEN: contextCanvasToken,
      ...extraEnv,
    },
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[${name}] exited via ${signal}`);
    } else if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

const apiPort = await findAvailablePort(Number(process.env.CONTEXT_CANVAS_PORT || 3001));
const apiTarget = `http://${bindHost}:${apiPort}`;
console.log(`Context Canvas dev API target: ${apiTarget}`);

const server = run("npx", ["tsx", "src/server/index.ts"], "server", {
  CONTEXT_CANVAS_BIND_HOST: bindHost,
  CONTEXT_CANVAS_PORT: String(apiPort),
});
const vite = run("npx", ["vite"], "vite", {
  CONTEXT_CANVAS_API_TARGET: apiTarget,
});

function shutdown() {
  server.kill();
  vite.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
