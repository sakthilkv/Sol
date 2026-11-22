import Dexie, { type Table } from "dexie";

export type Word = {
  id: number;
  engword: string;
  tamilword: string;
  dueAt: number;
  interval: number;
  ease: number;
  repetitions: number;
  seen: number;
  correct: number;
  lastReviewed?: number;
};

export type SessionLog = {
  id?: number;
  date: string;
  wordId: number;
  correct: boolean;
  direction: "en-ta" | "ta-en";
};

class VocabularyDB extends Dexie {
  words!: Table<Word, number>;
  sessions!: Table<SessionLog, number>;

  constructor() {
    super("sol-tamil-vocabulary");
    this.version(1).stores({
      words: "++id, engword, dueAt, lastReviewed",
      sessions: "++id, date, wordId"
    });
  }
}

export const db = new VocabularyDB();

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function seedIfEmpty() {
  if (await db.words.count()) return;
  const response = await fetch("/glossary.jsonl");
  if (!response.ok) throw new Error("Could not load glossary.jsonl");
  const text = await response.text();
  const entries = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  await db.words.bulkAdd(entries.map((entry: { engword: string; tamilword: string }, index: number) => ({
    id: index + 1,
    engword: entry.engword.trim(),
    tamilword: entry.tamilword.trim(),
    dueAt: 0,
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    seen: 0,
    correct: 0
  })));
}

export function normalize(value: string) {
  return value.toLocaleLowerCase().trim().replace(/\s+/g, " ").replace(/[.,!?;:]/g, "");
}

export function tamilVariants(value: string) {
  return value.split(/[\/,;|]/).map((v) => normalize(v)).filter(Boolean);
}

export async function recordAnswer(word: Word, correct: boolean, direction: "en-ta" | "ta-en") {
  const now = Date.now();
  const next = { ...word, seen: word.seen + 1, correct: word.correct + (correct ? 1 : 0), lastReviewed: now };
  if (correct) {
    next.repetitions += 1;
    next.interval = next.repetitions === 1 ? 1 : next.repetitions === 2 ? 3 : Math.max(1, Math.round(next.interval * next.ease));
    next.ease = Math.max(1.3, next.ease + 0.1);
  } else {
    next.repetitions = 0;
    next.interval = 0;
    next.ease = Math.max(1.3, next.ease - 0.2);
  }
  next.dueAt = now + next.interval * 24 * 60 * 60 * 1000;
  await db.words.put(next);
  await db.sessions.add({ date: todayKey(), wordId: word.id, correct, direction });
  return next;
}