// Pure date helpers for the one-click "advance" feature.
//
// All dates are YYYY-MM-DD strings in LOCAL time — the convention the rest of
// Cairn uses (see public/app.js parseLocalDate). Never use Date.toISOString()
// here: it is UTC and rolls a day early in negative-UTC zones (UTC).

export type CheckCadence = "weekly" | "monthly";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format local Y/M/D (m is 1-based) as YYYY-MM-DD. */
function fmt(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Split a YYYY-MM-DD string into a typed [year, month, day] tuple (month 1-based). */
function parts(dateStr: string): [number, number, number] {
  const p = dateStr.split("-");
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

/** Parse YYYY-MM-DD into a local Date at midnight. */
function parseLocal(dateStr: string): Date {
  const [y, m, d] = parts(dateStr);
  return new Date(y, m - 1, d);
}

/** Number of days in month `m` (1-based) of year `y`. */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** Today's local date as YYYY-MM-DD. */
export function localToday(): string {
  const d = new Date();
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Add `n` calendar days (DST-safe; not epoch-ms math). */
export function addDays(dateStr: string, n: number): string {
  const dt = parseLocal(dateStr);
  dt.setDate(dt.getDate() + n);
  return fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** Add `n` months, clamping the day-of-month to the target month's length. */
export function addMonthsClamped(dateStr: string, n: number): string {
  const [y, m, d] = parts(dateStr);
  const total = m - 1 + n;
  const ty = y + Math.floor(total / 12);
  const tm = (((total % 12) + 12) % 12) + 1; // 1-based
  return fmt(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

/**
 * Compute the next check date for an item the user just checked.
 *
 * `overdue` (dateStr < todayStr) decides the base:
 *  - not overdue: push the current due date forward one period (checked early).
 *  - overdue: jump to the next anchored occurrence strictly after today.
 *
 * The cadence anchor is derived from `dateStr` itself — weekly from its weekday,
 * monthly from its day-of-month. Accepted limitation: a monthly item on day
 * 29-31 that clamps in a short month (Jan 31 -> Feb 28) permanently loses the
 * original day, because the anchor is re-derived from the clamped date.
 */
export function advance(dateStr: string, cadence: CheckCadence, todayStr: string): string {
  // ISO YYYY-MM-DD strings: lexical order == chronological order.
  const overdue = dateStr < todayStr;

  if (cadence === "weekly") {
    if (!overdue) return addDays(dateStr, 7);
    // First occurrence of the anchor weekday strictly after today.
    const anchorDow = parseLocal(dateStr).getDay();
    const todayDow = parseLocal(todayStr).getDay();
    let delta = (anchorDow - todayDow + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(todayStr, delta);
  }

  // monthly
  if (!overdue) return addMonthsClamped(dateStr, 1);
  // Walk forward month-by-month from today. Clamping can collapse a day-30/31
  // candidate onto today itself, so loop until strictly after today.
  const anchorDay = parseLocal(dateStr).getDate();
  let [y, m] = parts(todayStr); // m is 1-based
  for (let i = 0; i < 14; i++) {
    const cand = fmt(y, m, Math.min(anchorDay, daysInMonth(y, m)));
    if (cand > todayStr) return cand;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  // Unreachable for valid inputs; keeps the type checker satisfied.
  return addMonthsClamped(dateStr, 1);
}
