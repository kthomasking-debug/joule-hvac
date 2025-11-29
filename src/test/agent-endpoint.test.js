/* eslint-env node */
import { describe, it, expect } from "vitest";
import "../setupTests.js"; // if global fetch/polyfills
import "../../server/temperature-server.js"; // ensure server started
import http from "http";

// Helper to perform POST and collect SSE lines
function postSSE(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    // Use fixed default port (tests assume 3001); configurable port not required here
    const port = 3001;
    const headers = { "Content-Type": "application/json" };
    // If auth key set globally (injected) include it without referencing process to satisfy lint
    const globalKey = globalThis.AGENT_API_KEY || undefined;
    if (globalKey) headers["x-agent-key"] = globalKey;
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path,
        method: "POST",
        headers,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk.toString();
        });
        res.on("end", () => {
          const events = [];
          for (const block of raw.split("\n\n")) {
            const line = block.trim();
            if (!line.startsWith("data:")) continue;
            try {
              events.push(JSON.parse(line.slice(5)));
            } catch {
              // ignore parse errors for incomplete chunks
            }
          }
          resolve(events);
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

describe("Agent endpoint basic streaming", () => {
  it("returns goal, plan, and final with jouleScore tool for score query", async () => {
    const events = await postSSE("/api/agent", {
      goal: "Show joule score efficiency",
    });
    const types = events.map((e) => e.type);
    expect(types).toContain("goal");
    expect(types).toContain("plan");
    expect(types).toContain("final");
    // ensure at least one tool_result includes jouleScore structure
    const jouleResult = events.find(
      (e) => e.type === "tool_result" && e.tool === "getJouleScore"
    );
    expect(jouleResult).toBeTruthy();
    expect(jouleResult.output).toHaveProperty("jouleScore");
  });
});
