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

function parseLocalDate(iso) {
  // Parse a YYYY-MM-DD as local midnight (NOT UTC — `new Date("2026-04-28")`
  // is UTC midnight, which lands on the prior day in negative-UTC zones).
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Due-date label for a list row. The countdown is to the lead date
// (due − lead_days); the weekday is that lead date's; "(due +N)" is how many
// days further the actual due date sits. lead_days 0 collapses to the due
// date itself. e.g. "4d, Fri (due +1)" or "27d, Sun (due +0)".
function dueLabelText(it) {
  if (!it.next_action_date) return "no date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(it.next_action_date);
  const lead = it.lead_days || 0;
  const effective = new Date(due);
  effective.setDate(effective.getDate() - lead);
  const days = Math.round((effective - today) / 86400000);
  const wk = effective.toLocaleDateString(undefined, { weekday: "short" });
  let daysPart;
  if (days < 0) daysPart = `overdue ${Math.abs(days)}d`;
  else if (days === 0) daysPart = "today";
  else if (days === 1) daysPart = "tomorrow";
  else daysPart = `${days}d`;
  return `${daysPart}, ${wk} (due +${lead})`;
}

function checkedLabel(ts) {
  // ts may be a full datetime ("YYYY-MM-DD HH:MM:SS") — keep only the date part.
  const d = parseLocalDate(ts.slice(0, 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - d) / 86400000);
  if (days <= 0) return "checked today";
  if (days === 1) return "checked yesterday";
  if (days < 7) return `checked ${days}d ago`;
  return `checked ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
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

// Snooze is deactivated (see src/features.ts — keep this mirror flag in sync).
// When false: no SNOOZE button, no "snoozed → …" badge. The case "snooze"
// handler below is left intact but unreachable.
const SNOOZE_ENABLED = false;

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

function stoneTilt(seed) {
  return ((seed * 17) % 9) - 4;
}

const STONE_SVG = `<svg class="routine-stone" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="13" rx="6" ry="3.5" fill="var(--muted)"/><ellipse cx="32" cy="22" rx="10" ry="5" fill="var(--accent-warm)"/><ellipse cx="32" cy="33" rx="14" ry="6.5" fill="var(--slate)"/><ellipse cx="32" cy="46" rx="20" ry="9" fill="var(--accent)"/><line x1="6" y1="56" x2="58" y2="56" stroke="var(--border)" stroke-width="1" stroke-linecap="round"/></svg>`;

const SVG_ATTRS = 'viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  gonna:   `<svg ${SVG_ATTRS}><polyline points="20 6 9 17 4 12"/></svg>`,
  snooze:  `<svg ${SVG_ATTRS}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  maybe:   `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  archive: `<svg ${SVG_ATTRS}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  recheck: `<svg ${SVG_ATTRS}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  restore: `<svg ${SVG_ATTRS}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>`,
  advance: `<svg ${SVG_ATTRS}><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`,
  calendar: `<svg ${SVG_ATTRS}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
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
        return `<div class="routine-row completed" data-id="${it.id}" draggable="true">
          ${emoji}<span class="routine-title">${escapeHtml(it.title)}</span>
          <span class="routine-done" aria-label="done" style="--stone-tilt:${stoneTilt(it.id)}deg">${STONE_SVG}</span>
        </div>`;
      }
      return `<div class="routine-row" data-id="${it.id}" data-editable="1" draggable="true">
        ${emoji}<span class="routine-title">${escapeHtml(it.title)}</span>
        <button class="routine-btn" data-action="routine-complete">STACK</button>
      </div>`;
    })
    .join("");
}

function initRoutineDrag() {
  const container = document.getElementById("routine-list");
  if (!container || container.dataset.dragWired === "1") return;
  container.dataset.dragWired = "1";

  let draggedEl = null;
  let lastTarget = null;
  let lastHalf = null;
  let originalOrder = "";
  let dropped = false;

  function snapshotOrder() {
    return Array.from(container.querySelectorAll(".routine-row"))
      .map((el) => el.dataset.id)
      .join(",");
  }

  // FLIP: capture row positions, mutate DOM, then invert + animate displaced rows
  // back to where they were and let CSS transition them to their new home.
  function flipMove(mutate) {
    const rows = Array.from(container.querySelectorAll(".routine-row"));
    const before = new Map(
      rows.map((el) => [el, el.getBoundingClientRect().top]),
    );
    mutate();
    for (const el of rows) {
      if (el === draggedEl) continue;
      const dy = before.get(el) - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 160ms ease-out";
        el.style.transform = "";
        el.addEventListener(
          "transitionend",
          () => {
            el.style.transition = "";
            el.style.transform = "";
          },
          { once: true },
        );
      });
    }
  }

  container.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".routine-row");
    if (!row) return;
    draggedEl = row;
    originalOrder = snapshotOrder();
    dropped = false;
    lastTarget = null;
    lastHalf = null;
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", row.dataset.id);
  });

  container.addEventListener("dragover", (e) => {
    if (!draggedEl) return;
    const row = e.target.closest(".routine-row");
    if (!row || row === draggedEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = row.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    if (row === lastTarget && after === lastHalf) return;
    lastTarget = row;
    lastHalf = after;
    flipMove(() => {
      if (after) row.parentNode.insertBefore(draggedEl, row.nextSibling);
      else row.parentNode.insertBefore(draggedEl, row);
    });
  });

  container.addEventListener("drop", (e) => {
    if (!draggedEl) return;
    e.preventDefault();
    dropped = true;
  });

  container.addEventListener("dragend", async () => {
    if (!draggedEl) return;
    draggedEl.classList.remove("dragging");
    const wasDropped = dropped;
    const finalOrder = snapshotOrder();
    const changed = finalOrder !== originalOrder;
    draggedEl = null;
    lastTarget = null;
    lastHalf = null;
    dropped = false;

    if (wasDropped && changed) {
      const ids = finalOrder.split(",").map(Number);
      try {
        await api("/routine/reorder", {
          method: "POST",
          body: JSON.stringify({ ids }),
        });
      } catch (err) {
        alert("Reorder failed: " + err.message);
        await refreshAll();
      }
    } else if (changed) {
      // user cancelled mid-drag (drop outside target) — restore original order
      await refreshAll();
    }
  });
}

function renderItemList(containerId, items, opts = {}) {
  const container = document.getElementById(containerId);
  if (items.length === 0) {
    container.innerHTML = `<p class="empty">${opts.emptyText || "Empty."}</p>`;
    return;
  }
  container.innerHTML = items.map((it) => itemRowHtml(it, opts)).join("");
}

// Normalize an item URL: assume https when there is no scheme, strip the
// scheme for display, and truncate the display text to 25 characters.
function urlParts(raw) {
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let display = raw.replace(/^https?:\/\//i, "");
  if (display.length > 25) display = display.slice(0, 25) + "…";
  return { href, display };
}

function itemRowHtml(it, opts) {
  const emoji = it.emoji
    ? `<span class="item-emoji">${escapeHtml(it.emoji)}</span>`
    : "<span></span>";
  const dueValue = it.next_action_date || "";
  const dueLabel = dueLabelText(it);
  const dueEmptyClass = it.next_action_date ? "" : " item-due-empty";
  const due = `<span class="item-due" title="Change date">
      <span class="item-due-label${dueEmptyClass}">${dueLabel}</span>
      <input type="date" class="item-due-picker" value="${dueValue}" tabindex="-1" aria-label="Change date">
    </span>`;
  const meta = [due];
  if (SNOOZE_ENABLED && it.snoozed_until) meta.push(`snoozed → ${it.snoozed_until}`);
  if (it.last_checked_at) meta.push(checkedLabel(it.last_checked_at));
  const notesHtml = it.notes
    ? `<div class="item-notes" title="${escapeHtml(it.notes)}">${escapeHtml(it.notes)}</div>`
    : "";

  const isActive = !opts.archive && !opts.mim;
  let urlLink = "";
  if (isActive && it.url && it.url.trim()) {
    const { href, display } = urlParts(it.url.trim());
    urlLink = `<a class="item-url" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(href)}">${escapeHtml(display)}</a>`;
  }

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
      iconBtn("advance", it.check_cadence ? "advance" : "calendar",
        it.check_cadence ? "I checked this — advance the date" : "Set a new check date"),
      iconBtn("recheck", "recheck", manual ? "Recheck (auto-mode only)" : "Recheck now", manual),
      SNOOZE_ENABLED ? iconBtn("snooze", "snooze", "Snooze") : "",
      iconBtn("maybe", "maybe", "Maybe someday — move to MIM"),
      iconBtn("archive", "archive", "Archive"),
    ].join("");
  }

  const editable = opts.archive ? "" : ` data-editable="1"`;
  return `<div class="item-row" data-id="${it.id}" data-mode="${it.mode}" data-cadence="${it.check_cadence || ""}"${editable}>
    ${emoji}
    <div class="item-main">
      <div class="item-titlerow">
        <div class="item-title" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</div>${urlLink}
      </div>
      <div class="item-meta">${meta.join(" · ")}</div>
      ${notesHtml}
    </div>
    <div class="item-actions">${actions}</div>
  </div>`;
}

let lastListsFp = null;
let lastSettingsFp = null;

async function refreshAll() {
  document.getElementById("today-date").textContent = todayLabel();
  // Don't tear down an in-progress drag with a poll-driven re-render.
  if (document.querySelector(".routine-row.dragging")) return;
  try {
    const [routine, active, mim, settings] = await Promise.all([
      api("/routine/today"),
      api("/items?list=active"),
      api("/items?list=mim"),
      api("/settings"),
    ]);

    const listsFp = JSON.stringify([routine, active, mim]);
    if (listsFp !== lastListsFp) {
      lastListsFp = listsFp;
      renderRoutine(routine.items);
      initRoutineDrag();
      renderItemList("cairn-list", active.items, { emptyText: "Nothing on the cairn yet." });
      renderItemList("mim-list", mim.items, { mim: true, emptyText: "Empty." });
      const mimCount = document.getElementById("mim-count");
      if (mimCount) mimCount.textContent = mim.items.length ? `(${mim.items.length})` : "";
    }

    const settingsFp = JSON.stringify(settings);
    if (settingsFp !== lastSettingsFp) {
      lastSettingsFp = settingsFp;
      applyUiConfig(settings.current);
    }
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

  // Add item (must run before section-toggle so "+" in MIM header doesn't collapse)
  const addBtn = target.closest('[data-action="add-item"]');
  if (addBtn) {
    e.stopPropagation();
    openItemDialog({ list: addBtn.dataset.list });
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
    // Click-to-edit: anywhere on an editable row that isn't a button, link, or the due label
    if (row.dataset.editable === "1" && !target.closest("button, a")) {
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
      case "advance": {
        const cadence = row.dataset.cadence;
        const picker = row.querySelector(".item-due-picker");
        if (cadence && picker && picker.value) {
          actionEl.disabled = true;
          try {
            await api(`/items/${id}/advance`, { method: "POST" });
            await refreshAll();
          } finally {
            actionEl.disabled = false;
          }
        } else if (picker) {
          // No cadence (or no date to anchor from): just drop the calendar.
          if (typeof picker.showPicker === "function") picker.showPicker();
          else picker.focus();
        }
        break;
      }
      case "routine-complete": {
        actionEl.disabled = true;
        row.classList.add("glowing");
        await api(`/routine/${id}/complete`, { method: "POST" });
        setTimeout(() => refreshAll(), 750);
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

function openItemDialog(seed = null) {
  const dialog = document.getElementById("item-dialog");
  const form = document.getElementById("item-form");
  form.reset();
  closeEmojiPicker();
  const editing = !!(seed && seed.id);
  document.getElementById("item-dialog-title").textContent = editing ? "Edit item" : "Add item";
  if (editing) {
    form.id.value = seed.id;
    form.emoji.value = seed.emoji || "";
    form.title.value = seed.title;
    form.list.value = seed.list;
    form.next_action_date.value = seed.next_action_date || "";
    form.check_cadence.value = seed.check_cadence || "";
    form.lead_days.value = seed.lead_days ?? 0;
    form.notes.value = seed.notes || "";
    form.url.value = seed.url || "";
    form.mode.value = seed.mode || "manual";
    form.check_schedule.value = seed.check_schedule || "";
    form.automation_type.value = seed.automation_type || "";
    form.automation_config.value = seed.automation_config || "";
  } else {
    form.id.value = "";
    if (seed && seed.list) form.list.value = seed.list;
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
    check_cadence: data.check_cadence || null,
    lead_days: parseInt(data.lead_days, 10) || 0,
    mode: data.mode,
    url: data.url || null,
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

function applyUiConfig(values) {
  const ui = values || window.CAIRN_UI || {};
  for (const note of document.querySelectorAll(".editable-note")) {
    if (note.classList.contains("editing")) continue; // don't clobber active edit
    const key = note.dataset.key;
    if (key && ui[key] != null) {
      note.textContent = ui[key];
      if (!note.classList.contains("editing")) note.title = "Click to edit";
    }
  }
}
applyUiConfig();

async function saveSetting(key, value) {
  const { current } = await api("/settings", {
    method: "PATCH",
    body: JSON.stringify({ [key]: value }),
  });
  applyUiConfig(current);
}

function startNoteEdit(note) {
  if (note.classList.contains("editing")) return;
  note.classList.add("editing");
  note.contentEditable = "plaintext-only";
  note.title = "";
  const reset = document.querySelector(`.note-reset-btn[data-target="${note.id}"]`);
  if (reset) reset.hidden = false;
  note.focus();
  // Select all text so a fresh edit can replace it.
  const range = document.createRange();
  range.selectNodeContents(note);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

async function commitNoteEdit(note) {
  if (!note.classList.contains("editing")) return;
  const key = note.dataset.key;
  const text = note.textContent.trim();
  note.classList.remove("editing");
  note.contentEditable = "false";
  const reset = document.querySelector(`.note-reset-btn[data-target="${note.id}"]`);
  if (reset) reset.hidden = true;
  note.title = "Click to edit";
  try {
    await saveSetting(key, text === "" ? null : text);
  } catch (err) {
    alert("Failed to save: " + err.message);
  }
}

document.addEventListener("click", (e) => {
  const note = e.target.closest(".editable-note");
  if (note && !note.classList.contains("editing")) {
    e.preventDefault();
    startNoteEdit(note);
  }
});

// Keep focus on the contenteditable note when the reset button is pressed,
// otherwise blur fires before click and commitNoteEdit hides the button.
document.addEventListener("mousedown", (e) => {
  if (e.target.closest(".note-reset-btn")) e.preventDefault();
});

document.addEventListener("click", async (e) => {
  const reset = e.target.closest(".note-reset-btn");
  if (!reset) return;
  e.preventDefault();
  e.stopPropagation();
  const note = document.getElementById(reset.dataset.target);
  if (!note) return;
  const key = note.dataset.key;
  try {
    const { current } = await api("/settings", {
      method: "PATCH",
      body: JSON.stringify({ [key]: null }),
    });
    note.textContent = current[key] ?? "";
    if (note.classList.contains("editing")) note.focus();
  } catch (err) {
    alert("Failed to reset: " + err.message);
  }
});

document.addEventListener("blur", (e) => {
  const note = e.target.closest?.(".editable-note");
  if (note && note.classList.contains("editing")) commitNoteEdit(note);
}, true);

document.addEventListener("keydown", (e) => {
  const note = e.target.closest?.(".editable-note");
  if (!note || !note.classList.contains("editing")) return;
  if (e.key === "Enter") {
    e.preventDefault();
    note.blur();
  } else if (e.key === "Escape") {
    e.preventDefault();
    // Revert text from server-side source of truth.
    note.classList.remove("editing");
    note.contentEditable = "false";
    const reset = document.querySelector(`.note-reset-btn[data-target="${note.id}"]`);
    if (reset) reset.hidden = true;
    applyUiConfig();
  }
});

refreshAll();

// Auto-refresh when the tab regains focus (catches overnight cron resets) and
// poll every 60s as a fallback. Render only fires when the response actually
// differs (see lastFingerprint), so idle ticks are invisible.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshAll();
});
setInterval(refreshAll, 60000);
