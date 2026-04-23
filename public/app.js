const API = "/api";
let TOKEN = localStorage.getItem("cairn_token");
if (!TOKEN) {
  TOKEN = prompt("Bearer token (one-time):");
  if (TOKEN) localStorage.setItem("cairn_token", TOKEN);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      localStorage.removeItem("cairn_token");
    }
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function relTime(iso) {
  if (!iso) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return `overdue ${Math.abs(days)}d`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

const COMPLETED_ICONS = ["☀️", "✨", "🪨", "⭐", "🌿", "☕", "🌾"];
function completedIcon(seed) {
  return COMPLETED_ICONS[seed % COMPLETED_ICONS.length];
}

function renderRoutine(items) {
  const container = document.getElementById("routine-list");
  if (items.length === 0) {
    container.innerHTML = `<p class="empty">No morning items yet.</p>`;
    return;
  }
  container.innerHTML = items
    .map((it) => {
      const emoji = it.emoji ? `<span class="routine-emoji">${escapeHtml(it.emoji)}</span>` : "";
      if (it.completed_today) {
        return `<div class="routine-row completed" data-id="${it.id}">
          ${emoji}<span class="routine-title">${escapeHtml(it.title)}</span>
          <span class="routine-done" aria-label="done">${completedIcon(it.id)}</span>
        </div>`;
      }
      return `<div class="routine-row" data-id="${it.id}">
        ${emoji}<span class="routine-title">${escapeHtml(it.title)}</span>
        <button class="routine-btn" data-action="routine-complete">DONE</button>
      </div>`;
    })
    .join("");
}

function renderItemList(containerId, items, opts = {}) {
  const container = document.getElementById(containerId);
  if (items.length === 0) {
    container.innerHTML = `<p class="empty">${opts.emptyText || "Empty."}</p>`;
    return;
  }
  container.innerHTML = items.map((it) => itemRowHtml(it, opts)).join("");
}

function itemRowHtml(it, opts) {
  const emoji = it.emoji
    ? `<span class="item-emoji">${escapeHtml(it.emoji)}</span>`
    : "<span></span>";
  const due = it.next_action_date ? `due ${relTime(it.next_action_date)}` : "no date";
  const meta = [due];
  if (it.snoozed_until) meta.push(`snoozed → ${it.snoozed_until}`);
  if (it.last_checked_at) meta.push(`checked ${relTime(it.last_checked_at)}`);
  if (it.notes) meta.push(`<em>${escapeHtml(it.notes)}</em>`);

  let actions;
  if (opts.archive) {
    actions = `<button class="btn" data-action="restore">restore</button>`;
  } else if (opts.mim) {
    actions = `
      <button class="btn" data-action="gonna">GONNA</button>
      <button class="btn" data-action="archive">ARCHIVE</button>
      <button class="btn" data-action="edit">edit</button>`;
  } else {
    const recheckDisabled = it.mode === "manual" ? "disabled" : "";
    actions = `
      <button class="btn" data-action="recheck" ${recheckDisabled}>recheck</button>
      <button class="btn" data-action="snooze">SNOOZE</button>
      <button class="btn" data-action="maybe">MAYBE</button>
      <button class="btn" data-action="archive">ARCHIVE</button>
      <button class="btn" data-action="edit">edit</button>`;
  }

  return `<div class="item-row" data-id="${it.id}" data-mode="${it.mode}">
    ${emoji}
    <div class="item-main">
      <div class="item-title">${escapeHtml(it.title)}</div>
      <div class="item-meta">${meta.join(" · ")}</div>
    </div>
    <div class="item-actions">${actions}</div>
  </div>`;
}

async function refreshAll() {
  document.getElementById("today-date").textContent = todayLabel();
  try {
    const [routine, active, mim] = await Promise.all([
      api("/routine/today"),
      api("/items?list=active"),
      api("/items?list=mim"),
    ]);
    renderRoutine(routine.items);
    renderItemList("cairn-list", active.items, { emptyText: "Nothing on the cairn yet." });
    renderItemList("mim-list", mim.items, { mim: true, emptyText: "Empty." });
  } catch (err) {
    if (String(err).includes("401")) {
      location.reload();
    } else {
      alert("Failed to load: " + err.message);
    }
  }
}

async function refreshArchive() {
  const archive = await api("/items?list=archived");
  renderItemList("archive-list", archive.items, { archive: true, emptyText: "Archive is empty." });
}

document.addEventListener("click", async (e) => {
  const target = e.target;

  // Close dialog
  if (target.matches("[data-close-dialog]")) {
    target.closest("dialog").close();
    return;
  }

  // Section toggle (clicking title or the icon span)
  const toggle = target.closest(".section-toggle");
  if (toggle) {
    const section = toggle.closest(".section");
    section.classList.toggle("section-collapsed");
    section.classList.toggle("section-expanded");
    return;
  }

  // Send digest
  if (target.id === "send-digest-btn") {
    target.disabled = true;
    try {
      const result = await api("/digest/send", { method: "POST" });
      alert(
        result.sent
          ? `Sent (${result.itemCount} item${result.itemCount === 1 ? "" : "s"}) to ${result.to}`
          : `Skipped: ${result.reason}`,
      );
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      target.disabled = false;
    }
    return;
  }

  // Add item
  if (target.id === "add-item-btn") {
    openItemDialog();
    return;
  }

  // Archive view
  if (target.id === "archive-btn") {
    await refreshArchive();
    document.getElementById("archive-dialog").showModal();
    return;
  }

  // Row actions
  const action = target.dataset.action;
  const row = target.closest(".routine-row, .item-row");
  if (!row || !action) return;
  const id = row.dataset.id;

  try {
    switch (action) {
      case "routine-complete": {
        target.disabled = true;
        row.classList.add("glowing");
        await api(`/routine/${id}/complete`, { method: "POST" });
        setTimeout(() => refreshAll(), 1500);
        break;
      }
      case "gonna":
        await api(`/items/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ list: "active" }),
        });
        await refreshAll();
        break;
      case "maybe":
        await api(`/items/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ list: "mim" }),
        });
        await refreshAll();
        break;
      case "archive":
        await api(`/items/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ list: "archived" }),
        });
        await refreshAll();
        if (document.getElementById("archive-dialog").open) await refreshArchive();
        break;
      case "snooze": {
        const days = parseInt(prompt("Snooze how many days?", "7"), 10);
        if (!Number.isFinite(days) || days < 1) return;
        await api(`/items/${id}/snooze`, {
          method: "POST",
          body: JSON.stringify({ days }),
        });
        await refreshAll();
        break;
      }
      case "recheck":
        target.disabled = true;
        try {
          const result = await api(`/items/${id}/recheck`, { method: "POST" });
          alert("Recheck: " + result.result.status);
          await refreshAll();
        } finally {
          target.disabled = false;
        }
        break;
      case "restore":
        await api(`/items/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ list: "active" }),
        });
        await refreshArchive();
        await refreshAll();
        break;
      case "edit": {
        const { item } = await api(`/items/${id}`);
        openItemDialog(item);
        break;
      }
    }
  } catch (err) {
    alert("Failed: " + err.message);
  }
});

function openItemDialog(item = null) {
  const dialog = document.getElementById("item-dialog");
  const form = document.getElementById("item-form");
  form.reset();
  document.getElementById("item-dialog-title").textContent = item ? "Edit item" : "Add item";
  if (item) {
    form.id.value = item.id;
    form.emoji.value = item.emoji || "";
    form.title.value = item.title;
    form.list.value = item.list;
    form.next_action_date.value = item.next_action_date || "";
    form.lead_days.value = item.lead_days ?? 0;
    form.notes.value = item.notes || "";
    form.mode.value = item.mode || "manual";
    form.check_schedule.value = item.check_schedule || "";
    form.automation_type.value = item.automation_type || "";
    form.automation_config.value = item.automation_config || "";
  } else {
    form.id.value = "";
  }
  form.classList.toggle("mode-auto", form.mode.value === "auto");
  dialog.showModal();
}

document.getElementById("item-form").addEventListener("change", (e) => {
  if (e.target.name === "mode") {
    e.target.form.classList.toggle("mode-auto", e.target.value === "auto");
  }
});

document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const body = {
    title: data.title,
    emoji: data.emoji || null,
    list: data.list,
    notes: data.notes || null,
    next_action_date: data.next_action_date || null,
    lead_days: parseInt(data.lead_days, 10) || 0,
    mode: data.mode,
    check_schedule: data.check_schedule || null,
    automation_type: data.automation_type || null,
    automation_config: data.automation_config || null,
  };
  try {
    if (data.id) {
      await api(`/items/${data.id}`, { method: "PATCH", body: JSON.stringify(body) });
    } else {
      await api(`/items`, { method: "POST", body: JSON.stringify(body) });
    }
    document.getElementById("item-dialog").close();
    await refreshAll();
  } catch (err) {
    alert("Failed: " + err.message);
  }
});

refreshAll();
