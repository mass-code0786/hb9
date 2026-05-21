const { spawn } = require("node:child_process");

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const portUrl = "http://localhost:3210";

function spawnCommand(command, args, options) {
  if (!isWindows) return spawn(command, args, options);
  return spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], options);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(portUrl);
      if (response.ok || response.status < 500) return;
    } catch {
      await wait(1000);
    }
  }
  throw new Error(`Timed out waiting for ${portUrl}`);
}

function killProcessTree(child) {
  if (!child.pid || child.killed) return Promise.resolve();
  if (!isWindows) {
    child.kill("SIGTERM");
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    killer.on("exit", () => resolve());
    killer.on("error", () => resolve());
  });
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawnCommand(npxCmd, ["playwright", "test"], {
      stdio: "inherit",
      env: { ...process.env, HB9_SKIP_WEBSERVER: "1" }
    });
    child.on("exit", (code) => resolve(code || 0));
  });
}

(async () => {
  const server = spawnCommand(npmCmd, ["run", "dev", "--", "-p", "3210"], {
    stdio: "ignore",
    windowsHide: true
  });

  try {
    await waitForServer();
    const code = await runPlaywright();
    await killProcessTree(server);
    process.exit(code);
  } catch (error) {
    await killProcessTree(server);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
