// src/lib/history-store.ts
export type HistoryAction = "suggested" | "sent" | "copied" | "opened";
export type HistoryFilter = "all" | HistoryAction;

export interface HistoryEvent {
  id: string;
  time: string;           // HH:MM:SS local
  ts: number;             // epoch ms
  verse: string;          // "John 3:16"
  text: string;           // verse text
  translation: string;    // "WEB"
  confidence?: number;    // 0-100
  action: HistoryAction;
}

const LS_KEY = "proverse-live-history";

function read(): HistoryEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items: HistoryEvent[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

function nowStrings() {
  const d = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { time, ts: d.getTime() };
}

export const historyStore = {
  addEvent(e: Omit<HistoryEvent, "id" | "time" | "ts">) {
    const { time, ts } = nowStrings();
    const item: HistoryEvent = {
      id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
      time,
      ts,
      ...e,
    };
    const items = read();
    items.unshift(item);
    // keep at most 1000
    write(items.slice(0, 1000));
    return item;
  },

  getHistory(filter: HistoryFilter = "all"): HistoryEvent[] {
    const items = read();
    if (filter === "all") return items;
    return items.filter((e) => e.action === filter);
  },

  clear() {
    write([]);
  },

  exportToCSV(): string {
    const items = read();
    const header = [
      "id",
      "timestamp",
      "time",
      "action",
      "verse",
      "translation",
      "confidence",
      "text",
    ];
    const rows = items.map((e) => [
      e.id,
      new Date(e.ts).toISOString(),
      e.time,
      e.action,
      e.verse.replace(/"/g, '""'),
      e.translation,
      e.confidence ?? "",
      e.text.replace(/"/g, '""'),
    ]);
    const csv =
      header.join(",") +
      "\n" +
      rows.map((r) => r.map((v) => `"${String(v)}"`).join(",")).join("\n");
    return csv;
  },
};
