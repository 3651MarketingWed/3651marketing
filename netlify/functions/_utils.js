// netlify/functions/_utils.js
const API_BASE = "https://api.netlify.com/api/v1";

function requireAuth(context) {
  const user = context?.clientContext?.user;
  if (!user) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return user;
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

// forms list에서 name으로 form id 찾기
async function getFormIdByName({ siteId, token, formName }) {
  const forms = await netlifyFetch(`/sites/${siteId}/forms`, token);
  const found = forms.find((f) => f?.name === formName);
  return found?.id || null;
}

module.exports = {
  requireAuth,
  json,
  badRequest,
  serverError,
  netlifyFetch,
  getFormIdByName,
};
