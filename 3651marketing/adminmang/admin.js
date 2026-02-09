const $ = (id) => document.getElementById(id);

let items = [];
let authed = false;

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

function setHint(msg) {
  const el = $("hint");
  if (el) el.textContent = msg || "";
}

function getKey() {
  return sessionStorage.getItem("ADMIN_KEY") || "";
}
function setKey(k) {
  sessionStorage.setItem("ADMIN_KEY", k);
}
function clearKey() {
  sessionStorage.removeItem("ADMIN_KEY");
}

async function apiGet(path) {
  const key = getKey();
  if (!key) throw new Error("관리자 비밀번호가 필요합니다.");

  const res = await fetch(path, { headers: { "x-admin-key": key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `요청 실패: ${res.status}`);
  return data;
}

async function apiPost(path, body) {
  const key = getKey();
  if (!key) throw new Error("관리자 비밀번호가 필요합니다.");

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "x-admin-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `요청 실패: ${res.status}`);
  return data;
}

function setUIAuthed(on) {
  authed = on;
  $("logoutBtn").style.display = on ? "inline-flex" : "none";
  $("adminKey").style.display = on ? "none" : "inline-flex";
  $("unlockBtn").style.display = on ? "none" : "inline-flex";
}

function render() {
  const tbody = $("tbody");
  const q = ($("q").value || "").trim().toLowerCase();
  const sf = $("statusFilter").value;

  if (!authed) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">비밀번호 입력 후 “접속”을 누르세요.</td></tr>`;
    return;
  }

  const filtered = items.filter((it) => {
    const statusOk = (sf === "ALL") || (it._status === sf);
    if (!statusOk) return false;
    if (!q) return true;

    const name = (it?.data?.name || "").toLowerCase();
    const email = (it?.data?.email || "").toLowerCase();
    const msg = (it?.data?.message || "").toLowerCase();
    return name.includes(q) || email.includes(q) || msg.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">검색 결과가 없습니다.</td></tr>`;
    setHint("0건 표시");
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

window.addEventListener("DOMContentLoaded", () => {
  $("unlockBtn").addEventListener("click", async () => {
    const k = ($("adminKey").value || "").trim();
    if (!k) return alert("관리자 비밀번호를 입력하세요.");
    setKey(k);
    setUIAuthed(true);
    await loadList();
  });

  $("logoutBtn").addEventListener("click", () => {
    clearKey();
    items = [];
    setUIAuthed(false);
    render();
    setHint("");
  });

  $("refreshBtn").addEventListener("click", () => loadList());
  $("q").addEventListener("input", () => render());
  $("statusFilter").addEventListener("change", () => render());

  if (getKey()) {
    setUIAuthed(true);
    loadList();
  } else {
    setUIAuthed(false);
    render();
  }
});
