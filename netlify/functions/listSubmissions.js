// netlify/functions/listSubmissions.js
const { getStore } = require("@netlify/blobs");
const {
  requireAuth,
  json,
  serverError,
  netlifyFetch,
  getFormIdByName,
} = require("./_utils");

exports.handler = async (event, context) => {
  try {
    requireAuth(context);

    const SITE_ID = process.env.NETLIFY_SITE_ID;
    const API_TOKEN = process.env.NETLIFY_API_TOKEN;
    const FORM_NAME = process.env.NETLIFY_FORM_NAME || "contact";

    if (!SITE_ID || !API_TOKEN) {
      return json(500, { ok: false, error: "Missing env: NETLIFY_SITE_ID or NETLIFY_API_TOKEN" });
    }

    // 폼 ID 찾기
    const formId = await getFormIdByName({ siteId: SITE_ID, token: API_TOKEN, formName: FORM_NAME });
    if (!formId) {
      return json(404, { ok: false, error: `Form not found by name: ${FORM_NAME}` });
    }

    // submissions 가져오기(최신 100개)
    // Netlify API에 따라 per_page/page 지원. (확인 필요: 계정/환경에 따라 다를 수 있음)
    const headers = {
      Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}`,
    };

    const submissions = await netlifyFetch(`/forms/${formId}/submissions?per_page=100`, API_TOKEN);

    // 상태 store(Blobs)
    const store = getStore("ticket-status");

    // 각 submission id에 매핑된 status 읽기
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

    // 최신순 정렬(가능하면 created_at 기준)
    withStatus.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return json(200, { ok: true, items: withStatus });
  } catch (err) {
    return serverError(err);
  }
};
