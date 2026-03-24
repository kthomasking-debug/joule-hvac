import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const store = getStore("wellness-cloud-sync");

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function hashSyncKey(syncKey) {
  return createHash("sha256").update(String(syncKey || "")).digest("hex");
}

function recordKeyForSyncKey(syncKey) {
  return `wellness-sync:${hashSyncKey(syncKey)}`;
}

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || "").trim();
    const syncKey = String(body?.syncKey || "").trim();

    if (!syncKey || syncKey.length < 12) {
      return jsonResponse(400, { error: "A valid sync key is required." });
    }

    const key = recordKeyForSyncKey(syncKey);

    if (action === "pull") {
      const payload = await store.get(key, { type: "json" });
      if (!payload) {
        return jsonResponse(404, { found: false });
      }

      return jsonResponse(200, {
        found: true,
        payload,
      });
    }

    if (action === "push") {
      const payload = body?.payload;
      if (!payload || typeof payload !== "object") {
        return jsonResponse(400, { error: "A valid payload is required for push." });
      }

      const storedPayload = {
        ...payload,
        cloudStoredAt: new Date().toISOString(),
      };

      await store.setJSON(key, storedPayload);

      return jsonResponse(200, {
        ok: true,
        cloudStoredAt: storedPayload.cloudStoredAt,
      });
    }

    return jsonResponse(400, { error: "Unknown action." });
  } catch (error) {
    return jsonResponse(500, {
      error: error?.message || "Cloud sync failed.",
    });
  }
};