// admin.js (수정본)
const $ = (id) => document.getElementById(id);

let user = null;
let items = [];

// ----- utils -----
function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setHint(msg) {
  const el = $("hint");
  if (el) el.textContent = msg || "";
}

function setAuthUI(loggedIn) {
  const loginBtn = $("loginBtn");
  const logoutBtn = $("logoutBtn");
  if (loginBtn) loginBtn.style.display = loggedIn ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline-flex" : "none";
}

// ----- auth / api -----
async function authToken() {
  if (!user) throw new Error("로그인이 필요합니다.");
  // netlify identity user has jwt()
  const jwt = await user.jwt();
  if (!jwt) throw new Error("인증 토큰을 가져오지 못했습니다.");
  return jwt;
}

async function apiGet(path) {
  const token = await authToken();
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  // 함수가 {ok:false,error:"..."} 형태로 준다는 전제
  if (!res.ok || data.ok === false) {
    const msg = data.error || `요청 실패: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function apiPost(path, body) {
  const token = await authToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (!res.ok || data.ok === false) {
    const msg = data.error || `요청 실패: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ----- render -----
function render() {
  const qEl = $("q");
  const sfEl = $("statusFilter");
  const tbody = $("tbody");

  if (!tbody) return;

  const q = (qEl?.value || "").trim().toLowerCase();
  const sf = sfEl?.value || "ALL";

  if (!user) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">로그인 후 목록이 표시됩니다.</td></tr>`;
    setHint("");
    return;
  }

  const filtered = items.filter((it) => {
    const statusOk = sf === "ALL" || it._status === sf;
     if (!statusOk) return false;
     if (!q) return true;

    const name = (it?.data?.name || "").toLowerCase();
    const email = (it?.data?.email || "").toLowerCase();
    const msg = (it?.data?.message || "").toLowerCase();
    return name.includes(q) || email.includes(q) || msg.includes(q);
  }
);

   if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">검색 결과가 없습니다.</td></tr>`;
    setHint("0건 표시");
    return;
  }

  tbody.innerHTML = filtered
    .map((it) => {
      const id = it.id;
      const created = fmtDate(it.created_at);
      const name = escapeHtml(it?.data?.name || "-");
      const email = escapeHtml(it?.data?.email || "-");
      const message = escapeHtml(it?.data?.message || "-");
      const status = it._status || "NEW";

      return `
        <tr>
          <td class="nowrap">${created}</td>
          <td>${name}</td>
          <td>${email}</td>
          <td class="msg">${message}</td>
          <td class="nowrap">
            <select class="select status" data-id="${id}">
              <option value="NEW" ${status === "NEW" ? "selected" : ""}>NEW</option>
              <option value="IN_PROGRESS" ${status === "IN_PROGRESS" ? "selected" : ""}>IN_PROGRESS</option>
              <option value="DONE" ${status === "DONE" ? "selected" : ""}>DONE</option>
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  // 상태 변경 핸들러
  tbody.querySelectorAll("select.status").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const submissionId = e.target.getAttribute("data-id");
      const status = e.target.value;

      setHint("저장 중...");
      try {
        await apiPost("/.netlify/functions/updateStatus", { submissionId, status });
        const idx = items.findIndex((x) => x.id === submissionId);
        if (idx >= 0) items[idx]._status = status;
        setHint("저장 완료");
      } catch (err) {
        setHint("저장 실패");
        alert(err?.message || String(err));
      }
      render();
    });
  });

  setHint(`${filtered.length}건 표시`);
}

// ----- data -----
async function loadList() {
  setHint("불러오는 중...");
  try {
    const data = await apiGet("/.netlify/functions/listSubmissions");
    items = data.items || [];
    render();
  } catch (err) {
    setHint("불러오기 실패");
    alert(err?.message || String(err));
  }
}

// ----- identity -----
function initIdentity() {
  const loginBtn = $("loginBtn");

  if (!window.netlifyIdentity) {
    // 핵심: 여기서 막아두면 "로그인 눌러도 무반응"의 원인(위젯 로딩 실패)이 바로 드러남
    console.error("netlifyIdentity not loaded. Check script tag order / blocking.");
    if (loginBtn) loginBtn.disabled = true;
    alert("Netlify Identity 로딩 실패 (identity 위젯 스크립트 로드 확인)");
    return;
  }

  window.netlifyIdentity.on("init", (u) => {
    user = u;
    setAuthUI(!!user);
    render();
    if (user) loadList();
  });

  window.netlifyIdentity.on("login", (u) => {
    user = u;
    setAuthUI(true);
    window.netlifyIdentity.close();
    loadList();
  });

  window.netlifyIdentity.on("logout", () => {
    user = null;
    items = [];
    setAuthUI(false);
    render();
    setHint("");
  });

  window.netlifyIdentity.init();
}

// ----- boot -----
window.addEventListener("DOMContentLoaded", () => {
  const loginBtn = $("loginBtn");
  const logoutBtn = $("logoutBtn");
  const refreshBtn = $("refreshBtn");
  const qEl = $("q");
  const sfEl = $("statusFilter");

  // 버튼 이벤트 (netlifyIdentity가 아직 없을 수 있으니 안전 처리)
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (!window.netlifyIdentity) {
        alert("Identity 위젯이 아직 로드되지 않았습니다. 새로고침 후 다시 시도하세요.");
        return;
      }
      window.netlifyIdentity.open("login");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (!window.netlifyIdentity) return;
      window.netlifyIdentity.logout();
    });
  }

  if (refreshBtn) refreshBtn.addEventListener("click", () => loadList());
  if (qEl) qEl.addEventListener("input", () => render());
  if (sfEl) sfEl.addEventListener("change", () => render());

  initIdentity();
});
