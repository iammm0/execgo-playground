import http from "node:http";

const state = { latency_ms: 0, fail_mode: "none" };

const advisories = [
  { package: "express", affected_below: "4.18.3", id: "CVE-2023-0001", severity: "high" },
  { package: "undici", affected_below: "6.19.8", id: "CVE-2024-0002", severity: "medium" },
];

function json(response: http.ServerResponse, payload: Record<string, unknown>, status = 200): void {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": body.length,
  });
  response.end(body);
}

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function maybeDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, state.latency_ms));
}

const server = http.createServer(async (request, response) => {
  const route = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET") {
    if (route === "/healthz") {
      return json(response, { status: "ok", mode: { ...state } });
    }
    if (route === "/vuln/advisories") {
      await maybeDelay();
      if (state.fail_mode === "error") {
        return json(response, { error: "fixture service failure" }, 503);
      }
      return json(response, { advisories });
    }
    return json(response, { error: "not found" }, 404);
  }

  if (request.method === "POST" && route === "/control") {
    const payload = await readJson(request);
    state.latency_ms = Number(payload.latency_ms ?? 0);
    state.fail_mode = String(payload.fail_mode ?? "none");
    return json(response, { status: "updated", mode: { ...state } });
  }

  return json(response, { error: "not found" }, 404);
});

server.listen(8080, "0.0.0.0");
