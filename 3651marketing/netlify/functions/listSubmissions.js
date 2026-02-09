const { getStore } = require("@netlify/blobs");
const {
  requireAdminKey,
  json,
  serverError,
  netlifyFetch,
  getFormIdByName,
} = require("./_utils");

exports.handler = async (event) => {
  try {
    requireAdminKey(event);

    const SITE_ID = process.env.NETLIFY_SITE_ID;
    const API_TOKEN = process.env.NETLIFY_API_TOKEN;
    const FORM_NAME = process.env.NETLIFY_FORM_NAME || "contact";

    if (!SITE_ID || !API_TOKEN) {
      return json(500, { ok: false, error: "Missing env: NETLIFY_SITE_ID or NETLIFY_API_TOKEN" });
    }

    const formId = await getFormIdByName({ siteId: SITE_ID, token: API_TOKEN, formName: FORM_NAME });
    if (!formId) {
      return json(404, { ok: false, error: `Form not found by name: ${FORM_NAME}` });
    }

    const submissions = await netlifyFetch(`/forms/${formId}/submissions?per_page=100`, API_TOKEN);

    const store = getStore("ticket-status", { siteID: SITE_ID, token: API_TOKEN });


    const withStatus = await Promise.all(
      submissions.map(async (s) => {
        const id = s?.id;
        let status = "NEW";
        try {
          const saved = await store.get(`status:${id}`, { type: "json" });
          if (saved?.status) status = saved.status;
        } catch (_) {}
        return { ...s, _status: status };
      })
    );

    withStatus.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return json(200, { ok: true, items: withStatus });
  } catch (err) {
    return serverError(err);
  }
};
