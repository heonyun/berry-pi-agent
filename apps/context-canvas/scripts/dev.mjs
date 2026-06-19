import { spawn } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const contextCanvasToken = process.env.CONTEXT_CANVAS_TOKEN || crypto.randomBytes(32).toString("hex");
const bindHost = process.env.CONTEXT_CANVAS_BIND_HOST || "127.0.0.1";

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

async function findAvailableVitePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    const ipv4Available = await canListen(port, "127.0.0.1");
    const ipv6Available = await canListen(port, "::1");
    if (ipv4Available && ipv6Available) {
      return port;
    }
  }
  throw new Error(`No available Context Canvas Vite port found from ${startPort} to ${startPort + 99}.`);
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

const apiPort = await findAvailablePort(Number(process.env.CONTEXT_CANVAS_PORT || 3001), bindHost);
const vitePort = await findAvailableVitePort(Number(process.env.CONTEXT_CANVAS_VITE_PORT || 5173));
const apiTarget = `http://${bindHost}:${apiPort}`;
const allowedOrigins =
  process.env.CONTEXT_CANVAS_ALLOWED_ORIGINS ||
  [`http://localhost:${vitePort}`, `http://127.0.0.1:${vitePort}`].join(",");
console.log(`Context Canvas dev API target: ${apiTarget}`);
console.log(`Context Canvas dev allowed origins: ${allowedOrigins}`);

const server = run("npx", ["tsx", "src/server/index.ts"], "server", {
  CONTEXT_CANVAS_ALLOWED_ORIGINS: allowedOrigins,
  CONTEXT_CANVAS_BIND_HOST: bindHost,
  CONTEXT_CANVAS_PORT: String(apiPort),
});
const vite = run("npx", ["vite", "--port", String(vitePort), "--strictPort"], "vite", {
  CONTEXT_CANVAS_API_TARGET: apiTarget,
});

function shutdown() {
  server.kill();
  vite.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
