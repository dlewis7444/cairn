export type ItemList = "routine" | "active" | "mim" | "archived";
export type ItemMode = "manual" | "auto";
export type AutomationType = "script" | "playwright" | "ai" | null;

export interface Item {
  id: number;
  list: ItemList;
  title: string;
  emoji: string | null;
  notes: string | null;
  next_action_date: string | null;
  lead_days: number;
  snoozed_until: string | null;
  mode: ItemMode;
  automation_type: AutomationType;
  automation_config: string | null;
  check_schedule: string | null;
  last_checked_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: number;
  item_id: number | null;
  event_type: string;
  details: string | null;
  created_at: string;
}

export interface AppConfig {
  digest: {
    schedule: string;
    send_when_empty: boolean;
    subject_prefix: string;
  };
  backup: {
    schedule: string;
    retention_count: number;
  };
  ui: {
    name: string;
    tagline: string;
  };
  ai?: unknown;
}
