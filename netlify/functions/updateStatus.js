const { getStore } = require("@netlify/blobs");
const { requireAdminKey, json, badRequest, serverError } = require("./_utils");

const ALLOWED = new Set(["NEW", "IN_PROGRESS", "DONE"]);

exports.handler = async (event) => {
  try {
    requireAdminKey(event);

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON body");
    }

    const { submissionId, status } = body;
    if (!submissionId) return badRequest("submissionId is required");
    if (!ALLOWED.has(status)) return badRequest("status must be one of NEW/IN_PROGRESS/DONE");

    const store = getStore("ticket-status");
    await store.set(
      `status:${submissionId}`,
      { status, updatedAt: new Date().toISOString() },
      { type: "json" }
    );

    return json(200, { ok: true });
  } catch (err) {
    return serverError(err);
  }
};
