import fs from "fs";
import { ImapFlow } from "imapflow";
import seedProblems from "@/data/problems.json";
import seedSolutions from "@/data/solutions.json";

export const ENTRY_HEADER = "X-Frame-Entry";
export const ENTRY_SEARCH_TOKEN = "FRAMEENTRY";

const SEEDS = { problems: seedProblems, solutions: seedSolutions };
const CACHE_FILE = "/tmp/frame-of-reference-entries.json";
const CACHE_TTL_MS = 60 * 1000;
const MAX_MESSAGES = 400;
const MAILBOXES = ["[Gmail]/All Mail", "INBOX"];

let memoryCache = null;

function imapConfig() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return {
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  };
}

export function entryHeader(type, entry) {
  return Buffer.from(JSON.stringify({ type, ...entry }), "utf8").toString(
    "base64url"
  );
}

function parseEntries(source) {
  const headerEnd = source.search(/\r?\n\r?\n/);
  const headers = headerEnd === -1 ? source : source.slice(0, headerEnd);
  const m = headers.match(
    new RegExp(`^${ENTRY_HEADER}:\\s*([^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*)`, "im")
  );
  if (!m) return [];
  try {
    const e = JSON.parse(
      Buffer.from(m[1].replace(/\s+/g, ""), "base64url").toString("utf8")
    );
    return e.text && SEEDS[e.type] ? [e] : [];
  } catch {
    return [];
  }
}

async function readMailbox() {
  const config = imapConfig();
  if (!config) return null;
  const client = new ImapFlow(config);
  const result = { problems: [], solutions: [] };
  const seen = new Set();
  await client.connect();
  try {
    for (const name of MAILBOXES) {
      let lock;
      try {
        lock = await client.getMailboxLock(name);
      } catch {
        continue;
      }
      try {
        const uids = await client.search(
          { body: ENTRY_SEARCH_TOKEN },
          { uid: true }
        );
        const recent = (uids || []).slice(-MAX_MESSAGES);
        if (!recent.length) continue;
        for await (const msg of client.fetch(
          recent,
          { headers: [ENTRY_HEADER], envelope: true },
          { uid: true }
        )) {
          const id = msg.envelope?.messageId || msg.uid;
          if (seen.has(id)) continue;
          seen.add(id);
          parseEntries(msg.headers?.toString("utf8") || "").forEach((e) =>
            result[e.type].push({
              text: e.text,
              locations: e.locations || [],
              createdAt: e.createdAt,
            })
          );
        }
      } finally {
        lock.release();
      }
      if (result.problems.length || result.solutions.length) break;
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return result;
}

function readCacheFile() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeCacheFile(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch {
    // /tmp is best-effort; the mailbox remains the source of truth.
  }
}

async function loadStored() {
  const cached = memoryCache || readCacheFile();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  try {
    const fromMail = await readMailbox();
    if (fromMail) {
      memoryCache = { ...fromMail, fetchedAt: Date.now() };
      writeCacheFile(memoryCache);
      return memoryCache;
    }
  } catch (e) {
    console.warn("Could not read entries from mailbox:", e.message);
  }
  return cached || { problems: [], solutions: [], fetchedAt: 0 };
}

export async function getEntries(type) {
  const stored = await loadStored();
  const seedTexts = new Set(SEEDS[type].map((e) => e.text));
  return [
    ...SEEDS[type],
    ...(stored[type] || []).filter((e) => !seedTexts.has(e.text)),
  ];
}

export function rememberEntry(type, entry) {
  const base = memoryCache || readCacheFile() || {
    problems: [],
    solutions: [],
    fetchedAt: 0,
  };
  base[type] = [...(base[type] || []), entry];
  memoryCache = base;
  writeCacheFile(base);
}
