const API_BASE = "https://api.netlify.com/api/v1";

function requireAdminKey(event) {
  const got = event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    const err = new Error("ADMIN_KEY 미설정");
    err.statusCode = 500;
    throw err;
  }
  if (!got || got !== expected) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(bodyObj),
  };
}

function badRequest(msg) {
  return json(400, { ok: false, error: msg });
}

function serverError(err) {
  return json(err?.statusCode || 500, { ok: false, error: err?.message || "Server error" });
}

async function netlifyFetch(path, token, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Netlify API error: ${res.status} ${text}`);
    err.statusCode = res.status;
    throw err;
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

async function getFormIdByName({ siteId, token, formName }) {
  const forms = await netlifyFetch(`/sites/${siteId}/forms`, token);
  const found = forms.find((f) => f?.name === formName);
  return found?.id || null;
}

module.exports = {
  requireAdminKey,
  json,
  badRequest,
  serverError,
  netlifyFetch,
  getFormIdByName,
};
