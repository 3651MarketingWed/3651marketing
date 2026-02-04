const $ = (id) => document.getElementById(id);

let user = null;
let items = [];

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function authToken() {
  if (!user) throw new Error("로그인이 필요합니다.");
  const jwt = await user.jwt();
  return jwt;
}

async function apiGet(path) {
  const token = await authToken();
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `요청 실패: ${res.status}`);
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `요청 실패: ${res.status}`);
  return data;
}

function render() {
  const q = ($("q").value || "").trim().toLowerCase();
  const sf = $("statusFilter").value;

  const filtered = items.filter((it) => {
    const statusOk = (sf === "ALL") || (it._status === sf);
    if (!statusOk) return false;

    if (!q) return true;
    const name = (it?.data?.name || "").toLowerCase();
    const email = (it?.data?.email || "").toLowerCase();
    const msg = (it?.data?.message || "").toLowerCase();
    return name.includes(q) || email.includes(q) || msg.includes(q);
  });

  const tbody = $("tbody");
  if (!user) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">로그인 후 목록이 표시됩니다.</td></tr>`;
    return;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">검색 결과가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((it) => {
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
  }).join("");

  // 상태 변경 핸들러
  tbody.querySelectorAll("select.status").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const submissionId = e.target.getAttribute("data-id");
      const status = e.target.value;
      $("hint").textContent = "저장 중...";
      try {
        await apiPost("/.netlify/functions/updateStatus", { submissionId, status });
        const idx = items.findIndex((x) => x.id === submissionId);
        if (idx >= 0) items[idx]._status = status;
        $("hint").textContent = "저장 완료";
      } catch (err) {
        $("hint").textContent = "저장 실패";
        alert(err.message || String(err));
      }
      render();
    });
  });

  $("hint").textContent = `${filtered.length}건 표시`;
}

async function loadList() {
  $("hint").textContent = "불러오는 중...";
  try {
    const data = await apiGet("/.netlify/functions/listSubmissions");
    items = data.items || [];
    render();
  } catch (err) {
    $("hint").textContent = "불러오기 실패";
    alert(err.message || String(err));
  }
}

function setAuthUI(loggedIn) {
  $("loginBtn").style.display = loggedIn ? "none" : "inline-flex";
  $("logoutBtn").style.display = loggedIn ? "inline-flex" : "none";
}

function initIdentity() {
  if (!window.netlifyIdentity) {
    alert("Netlify Identity 로딩 실패");
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
  });

  window.netlifyIdentity.init();
}

window.addEventListener("DOMContentLoaded", () => {
  $("loginBtn").addEventListener("click", () => window.netlifyIdentity.open("login"));
  $("logoutBtn").addEventListener("click", () => window.netlifyIdentity.logout());
  $("refreshBtn").addEventListener("click", () => loadList());
  $("q").addEventListener("input", () => render());
  $("statusFilter").addEventListener("change", () => render());

  initIdentity();
});
