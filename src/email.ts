import nodemailer, { type Transporter } from "nodemailer";
import { env, loadConfig } from "./config.ts";
import { db, logAudit } from "./db.ts";
import type { Item, AppConfig } from "./types.ts";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

export function findImminentItems(today: Date = new Date()): Item[] {
  const iso = today.toISOString().slice(0, 10);
  return db
    .query<Item, [string, string]>(
      `SELECT * FROM items
       WHERE list = 'active'
         AND next_action_date IS NOT NULL
         AND date(next_action_date, '-' || lead_days || ' days') <= date(?)
         AND (snoozed_until IS NULL OR snoozed_until <= date(?))
       ORDER BY next_action_date ASC`,
    )
    .all(iso, iso);
}

export interface DigestResult {
  sent: boolean;
  reason?: string;
  itemCount: number;
  to: string;
}

export async function sendDigest(): Promise<DigestResult> {
  const config = loadConfig();
  const items = findImminentItems();
  const to = env.smtp.to;
  if (!to) {
    logAudit(null, "digest_skipped", { reason: "SMTP_TO not configured" });
    return { sent: false, reason: "SMTP_TO not configured", itemCount: items.length, to: "" };
  }
  if (items.length === 0 && !config.digest.send_when_empty) {
    logAudit(null, "digest_skipped", { reason: "no imminent items" });
    return { sent: false, reason: "no imminent items", itemCount: 0, to };
  }
  const { subject, html, text } = renderDigest(items, config);
  await getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });
  logAudit(null, "digest_sent", { itemCount: items.length });
  return { sent: true, itemCount: items.length, to };
}

function renderDigest(
  items: Item[],
  config: AppConfig,
): { subject: string; html: string; text: string } {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const tagline = config.ui.tagline;
  const prefix = config.digest.subject_prefix;

  const url = env.publicUrl;
  const textLink = url ? `\nOpen Cairn: ${url}\n` : "";
  const htmlLink = url
    ? `<p style="margin:0 0 16px 0;"><a href="${escape(url)}" style="color:#5f6e4f;text-decoration:none;">open Cairn →</a></p>`
    : "";

  if (items.length === 0) {
    const stats = describeStats();
    const subject = `${prefix} ${today} — nothing imminent`;
    const text = `Good morning.\n${textLink}\nNothing imminent today. ${stats}\n\n— ${tagline}\n`;
    const html = `<p>Good morning.</p>${htmlLink}<p>Nothing imminent today. ${escape(stats)}</p><p style="color:#888;font-size:12px;">— ${escape(tagline)}</p>`;
    return { subject, html, text };
  }

  const textLines = items.map((it) => {
    const emoji = it.emoji ? `${it.emoji} ` : "";
    const due = describeDue(it.next_action_date!);
    return `- ${emoji}${it.title} — ${due}${it.notes ? ` (${it.notes})` : ""}`;
  });
  const subject = `${prefix} ${items.length} item${items.length === 1 ? "" : "s"} on the cairn`;
  const text = `Good morning.\n${textLink}\n${textLines.join("\n")}\n\n— ${tagline}\n`;
  const htmlLines = items
    .map((it) => {
      const emoji = it.emoji ? `${escape(it.emoji)} ` : "";
      const due = describeDue(it.next_action_date!);
      const notes = it.notes ? ` <span style="color:#666">(${escape(it.notes)})</span>` : "";
      return `<li>${emoji}<strong>${escape(it.title)}</strong> — ${escape(due)}${notes}</li>`;
    })
    .join("");
  const html = `<p>Good morning.</p>${htmlLink}<ul>${htmlLines}</ul><p style="color:#888;font-size:12px;">— ${escape(tagline)}</p>`;
  return { subject, html, text };
}

function describeDue(dateIso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateIso);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "due today";
  if (diffDays === 1) return "due tomorrow";
  return `due in ${diffDays}d`;
}

function describeStats(): string {
  const row = db
    .query<{ active: number; mim: number; next_due: string | null }, []>(
      `SELECT
        (SELECT COUNT(*) FROM items WHERE list = 'active') AS active,
        (SELECT COUNT(*) FROM items WHERE list = 'mim') AS mim,
        (SELECT MIN(next_action_date) FROM items WHERE list = 'active' AND next_action_date IS NOT NULL) AS next_due`,
    )
    .get();
  if (!row) return "";
  const parts = [`${row.active} active`, `${row.mim} in MIM`];
  if (row.next_due) parts.push(`next due ${describeDue(row.next_due)}`);
  return parts.join(", ") + ".";
}

function escape(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
