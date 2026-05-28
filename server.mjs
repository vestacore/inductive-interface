import { createServer } from "node:http";
import { readFile, writeFile, appendFile, mkdir, copyFile, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const publicDir = path.join(__dirname, "public");
const schemasDir = path.join(__dirname, "schemas");
const seedStatePath = path.join(__dirname, "data", "seed", "semantic-observation-state.json");
const runtimeDir = path.join(__dirname, "data", "runtime");
const runtimeStatePath = path.join(runtimeDir, "semantic-observation-state.json");
const eventLogPath = path.join(runtimeDir, "substrate-events.jsonl");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureRuntime() {
  await mkdir(runtimeDir, { recursive: true });
  if (!(await exists(runtimeStatePath))) {
    await copyFile(seedStatePath, runtimeStatePath);
  }
  if (!(await exists(eventLogPath))) {
    await writeFile(eventLogPath, "", "utf8");
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function appendEvent(type, payload) {
  let previousHash = "";
  try {
    const raw = await readFile(eventLogPath, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length) previousHash = JSON.parse(lines[lines.length - 1]).hash;
  } catch {
    previousHash = "";
  }

  const event = {
    id: `evt_${randomUUID()}`,
    type,
    at: new Date().toISOString(),
    previousHash,
    payload
  };
  const hashInput = JSON.stringify(event);
  event.hash = createHash("sha256").update(hashInput).digest("hex");
  await appendFile(eventLogPath, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  if (Buffer.isBuffer(body)) {
    res.end(body);
    return;
  }
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function notFound(res) {
  send(res, 404, { error: "Not found" });
}

async function serveStatic(req, res, pathname) {
  const decoded = decodeURIComponent(pathname);
  const root =
    decoded.startsWith("/schemas/")
      ? schemasDir
      : decoded.startsWith("/docs/")
        ? path.join(__dirname, "docs")
        : publicDir;

  const relative =
    decoded === "/"
      ? "index.html"
      : decoded.startsWith("/schemas/")
        ? decoded.slice("/schemas/".length)
        : decoded.startsWith("/docs/")
          ? decoded.slice("/docs/".length)
          : decoded.replace(/^\/+/, "");

  const filePath = path.normalize(path.join(root, relative));
  if (!filePath.startsWith(root)) return notFound(res);

  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    send(res, 200, body, contentTypes[ext] || "application/octet-stream");
  } catch {
    notFound(res);
  }
}

async function handleApi(req, res, pathname) {
  await ensureRuntime();

  if (req.method === "GET" && pathname === "/api/state") {
    return send(res, 200, await readJson(runtimeStatePath));
  }

  if (req.method === "GET" && pathname === "/api/events") {
    const raw = await readFile(eventLogPath, "utf8");
    const events = raw.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    return send(res, 200, events);
  }

  if (req.method === "POST" && pathname === "/api/state/reset") {
    await copyFile(seedStatePath, runtimeStatePath);
    await writeFile(eventLogPath, "", "utf8");
    await appendEvent("state.reset", { source: "seed/semantic-observation-state.json" });
    return send(res, 200, await readJson(runtimeStatePath));
  }

  if (req.method === "POST" && pathname === "/api/contour") {
    const body = await readBody(req);
    const state = await readJson(runtimeStatePath);
    state.observation.contour = { ...state.observation.contour, ...body };
    state.updatedAt = new Date().toISOString();
    await writeJson(runtimeStatePath, state);
    await appendEvent("contour.updated", body);
    return send(res, 200, state);
  }

  if (req.method === "POST" && pathname === "/api/workflow") {
    const body = await readBody(req);
    const state = await readJson(runtimeStatePath);
    state.workflow = {
      ...state.workflow,
      ...body,
      frames: body.frames || state.workflow.frames
    };
    state.updatedAt = new Date().toISOString();
    await writeJson(runtimeStatePath, state);
    await appendEvent("workflow.updated", body);
    return send(res, 200, state);
  }

  if (req.method === "POST" && pathname === "/api/decisions") {
    const body = await readBody(req);
    const state = await readJson(runtimeStatePath);
    const decision = {
      id: body.id || `dec_${randomUUID()}`,
      decidedAt: new Date().toISOString(),
      decidedBy: body.decidedBy || "author",
      ...body
    };
    state.decisions = [...(state.decisions || []), decision];
    state.updatedAt = new Date().toISOString();
    await writeJson(runtimeStatePath, state);
    await appendEvent("decision.recorded", decision);
    return send(res, 201, { state, decision });
  }

  if (req.method === "POST" && pathname === "/api/corrections") {
    const body = await readBody(req);
    const state = await readJson(runtimeStatePath);
    const correction = {
      id: body.id || `corr_${randomUUID()}`,
      createdAt: new Date().toISOString(),
      createdBy: body.createdBy || "researcher",
      status: "posted",
      ...body
    };
    state.corrections = [...(state.corrections || []), correction];
    state.updatedAt = new Date().toISOString();
    await writeJson(runtimeStatePath, state);
    await appendEvent("correction.posted", correction);
    return send(res, 201, { state, correction });
  }

  if (req.method === "POST" && pathname === "/api/attestations") {
    const body = await readBody(req);
    const state = await readJson(runtimeStatePath);
    const attestation = {
      id: body.id || `att_${randomUUID()}`,
      signedAt: new Date().toISOString(),
      witnessId: body.witnessId || "named-witness",
      ...body
    };
    state.attestations = [...(state.attestations || []), attestation];
    state.updatedAt = new Date().toISOString();
    await writeJson(runtimeStatePath, state);
    await appendEvent("attestation.signed", attestation);
    return send(res, 201, { state, attestation });
  }

  if (req.method === "POST" && pathname === "/api/prepared-items") {
    const body = await readBody(req);
    const state = await readJson(runtimeStatePath);
    const prepared = {
      id: body.id || `prep_${randomUUID()}`,
      capturedAt: new Date().toISOString(),
      ...body
    };
    state.preparedItems = [...(state.preparedItems || []), prepared];
    state.updatedAt = new Date().toISOString();
    await writeJson(runtimeStatePath, state);
    await appendEvent("prepared.captured", prepared);
    return send(res, 201, { state, prepared });
  }

  return notFound(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url.pathname);
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    send(res, 500, { error: error.message || "Internal server error" });
  }
}).listen(PORT, () => {
  console.log(`Semantic Inductive UI running at http://localhost:${PORT}`);
});
