// Feature flags for Cairn.

// SNOOZE — deactivated 2026-05-15 (unused; left in place so it can be revived).
//
// Everything snooze-related is LEFT IN PLACE but inert, so it can be revived:
//   - the `snoozed_until` column and any existing data are untouched;
//   - POST /items/:id/snooze stays defined but returns 403 while disabled;
//   - the morning digest stops filtering on `snoozed_until`, so an item that
//     was previously snoozed simply behaves normally again (see email.ts);
//   - the web UI hides the SNOOZE button and the "snoozed → …" row badge.
//
// The frontend cannot import this file (plain-JS, no build step), so it carries
// its own mirror flag: SNOOZE_ENABLED in public/app.js — keep the two in sync.
//
// To turn it back on:  set this to true AND set SNOOZE_ENABLED = true in
//   public/app.js.
// To remove it entirely:  delete this flag, the /snooze route in
//   routes/items.ts, the snooze button + "case snooze" handler in app.js, the
//   snoozed_until branch in email.ts findImminentItems, and (optionally) the
//   `snoozed_until` column.
export const SNOOZE_ENABLED = false;
