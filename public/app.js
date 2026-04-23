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
  const dow = due.toLocaleDateString(undefined, { weekday: "short" });
  return `${days}d (${dow})`;
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

const EMOJI_PALETTE = [
  "📦","📫","🚚","🛒","🛍️","✉️","📜","🧾",
  "💸","💰","💳","🏦","📈","📉","🪙","📊",
  "🦷","💊","🩺","🏥","💉","🧠","🩹","🧖",
  "🏠","🔧","🔨","🧰","💡","🧹","🧺","🪴",
  "🚗","✈️","🛫","🚂","🧳","🛂","⛽","🚲",
  "☕","🍞","🍎","🥗","🥛","🍰","🍽️","🥚",
  "📞","📧","📅","🗓️","📋","📝","🖊️","📎",
  "🧘","🏃","🏋️","🚴","🛏️","💤","🪥","🧴",
  "🐈","🐕","🪨","🌿","🌻","🌾","🌅","🌙",
  "⚠️","🔔","⏰","⭐","❤️","✨","🎁","🎂",
];

const COMPLETED_ICONS = ["☀️", "✨", "🪨", "⭐", "🌿", "☕", "🌾"];
function completedIcon(seed) {
  return COMPLETED_ICONS[seed % COMPLETED_ICONS.length];
}

const SVG_ATTRS = 'viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  gonna:   `<svg ${SVG_ATTRS}><polyline points="20 6 9 17 4 12"/></svg>`,
  snooze:  `<svg ${SVG_ATTRS}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  maybe:   `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  archive: `<svg ${SVG_ATTRS}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  recheck: `<svg ${SVG_ATTRS}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  restore: `<svg ${SVG_ATTRS}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>`,
};
function iconBtn(action, icon, title, disabled = false) {
  return `<button class="btn btn-icon" data-action="${action}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"${disabled ? " disabled" : ""}>${ICONS[icon]}</button>`;
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
  const dueValue = it.next_action_date || "";
  const dueLabel = it.next_action_date ? relTime(it.next_action_date) : "no date";
  const dueEmptyClass = it.next_action_date ? "" : " item-due-empty";
  const due = `<span class="item-due" title="Change date">
      <span class="item-due-label${dueEmptyClass}">${dueLabel}</span>
      <input type="date" class="item-due-picker" value="${dueValue}" tabindex="-1" aria-label="Change date">
    </span>`;
  const meta = [due];
  if (it.snoozed_until) meta.push(`snoozed → ${it.snoozed_until}`);
  if (it.last_checked_at) meta.push(`checked ${relTime(it.last_checked_at)}`);
  const notesHtml = it.notes
    ? `<div class="item-notes" title="${escapeHtml(it.notes)}">${escapeHtml(it.notes)}</div>`
    : "";

  let actions;
  if (opts.archive) {
    actions = iconBtn("restore", "restore", "Restore to active");
  } else if (opts.mim) {
    actions = [
      iconBtn("gonna", "gonna", "Gonna — move back to active"),
      iconBtn("archive", "archive", "Archive"),
    ].join("");
  } else {
    const manual = it.mode === "manual";
    actions = [
      iconBtn("recheck", "recheck", manual ? "Recheck (auto-mode only)" : "Recheck now", manual),
      iconBtn("snooze", "snooze", "Snooze"),
      iconBtn("maybe", "maybe", "Maybe someday — move to MIM"),
      iconBtn("archive", "archive", "Archive"),
    ].join("");
  }

  const editable = opts.archive ? "" : ` data-editable="1"`;
  return `<div class="item-row" data-id="${it.id}" data-mode="${it.mode}"${editable}>
    ${emoji}
    <div class="item-main">
      <div class="item-title" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</div>
      <div class="item-meta">${meta.join(" · ")}</div>
      ${notesHtml}
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

function initEmojiPicker() {
  const picker = document.getElementById("emoji-picker");
  if (!picker) return;
  picker.innerHTML = EMOJI_PALETTE.map(
    (e) => `<button type="button" class="emoji-cell" data-emoji="${e}" aria-label="${e}">${e}</button>`,
  ).join("");
}
initEmojiPicker();

function closeEmojiPicker() {
  const picker = document.getElementById("emoji-picker");
  if (picker) picker.hidden = true;
}

document.addEventListener("click", async (e) => {
  const target = e.target;

  // Emoji picker: open/close
  if (target.closest("#emoji-pick-btn")) {
    const picker = document.getElementById("emoji-picker");
    if (picker) picker.hidden = !picker.hidden;
    return;
  }
  // Emoji picker: select
  const emojiCell = target.closest(".emoji-cell");
  if (emojiCell) {
    const input = document.querySelector('#item-form input[name="emoji"]');
    if (input) {
      input.value = emojiCell.dataset.emoji;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closeEmojiPicker();
    return;
  }
  // Emoji picker: click outside closes
  {
    const picker = document.getElementById("emoji-picker");
    if (picker && !picker.hidden && !picker.contains(target)) {
      picker.hidden = true;
    }
  }

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

  // Reset today's routine DONEs
  if (target.id === "routine-reset-btn") {
    try {
      await api("/routine/reset-today", { method: "POST" });
      await refreshAll();
    } catch (err) {
      alert("Failed: " + err.message);
    }
    return;
  }

  // Row actions / click-to-edit
  const row = target.closest(".routine-row, .item-row");
  if (!row) return;
  const id = row.dataset.id;
  const actionEl = target.closest("[data-action]");
  const action = actionEl?.dataset.action;

  // Due-days calendar picker
  const dueSpan = target.closest(".item-due");
  if (dueSpan && row.classList.contains("item-row")) {
    const picker = dueSpan.querySelector(".item-due-picker");
    if (picker && target !== picker) {
      e.preventDefault();
      if (typeof picker.showPicker === "function") picker.showPicker();
      else picker.focus();
    }
    return;
  }

  if (!action) {
    // Click-to-edit: anywhere on an editable item row that isn't a button or the due label
    if (
      row.classList.contains("item-row") &&
      row.dataset.editable === "1" &&
      !target.closest("button")
    ) {
      try {
        const { item } = await api(`/items/${id}`);
        openItemDialog(item);
      } catch (err) {
        alert("Failed: " + err.message);
      }
    }
    return;
  }

  try {
    switch (action) {
      case "routine-complete": {
        actionEl.disabled = true;
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
        actionEl.disabled = true;
        try {
          const result = await api(`/items/${id}/recheck`, { method: "POST" });
          alert("Recheck: " + result.result.status);
          await refreshAll();
        } finally {
          actionEl.disabled = false;
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
    }
  } catch (err) {
    alert("Failed: " + err.message);
  }
});

function openItemDialog(item = null) {
  const dialog = document.getElementById("item-dialog");
  const form = document.getElementById("item-form");
  form.reset();
  closeEmojiPicker();
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

document.addEventListener("change", async (e) => {
  if (!e.target.matches(".item-due-picker")) return;
  const row = e.target.closest(".item-row");
  if (!row) return;
  const id = row.dataset.id;
  const newDate = e.target.value || null;
  try {
    await api(`/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ next_action_date: newDate }),
    });
    await refreshAll();
  } catch (err) {
    alert("Failed: " + err.message);
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEmojiPicker();
});

function applyUiConfig() {
  const ui = window.CAIRN_UI || {};
  const morning = document.getElementById("morning-note");
  const cairn = document.getElementById("cairn-note");
  if (morning && ui.headerMorningCoffee) {
    morning.textContent = ui.headerMorningCoffee;
    morning.title = ui.headerMorningCoffee;
  }
  if (cairn && ui.headerTheCairn) {
    cairn.textContent = ui.headerTheCairn;
    cairn.title = ui.headerTheCairn;
  }
}
applyUiConfig();

refreshAll();
