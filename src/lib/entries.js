/**
 * Ticker entries live in ONE editable JSON document: a Gmail draft in the
 * admin@pooly.org mailbox with the subject TICKER_SUBJECT. Open it in
 * Gmail → Drafts to edit or delete any text. If the draft doesn't exist yet
 * it is created from src/data/problems.json + solutions.json on first write.
 */
import fs from "fs";
import { ImapFlow } from "imapflow";
import MailComposer from "nodemailer/lib/mail-composer";
import seedProblems from "@/data/problems.json";
import seedSolutions from "@/data/solutions.json";

export const TICKER_SUBJECT = "Frame of Reference ticker entries JSON";

const TYPES = ["problems", "solutions"];
const CACHE_FILE = "/tmp/frame-of-reference-entries.json";
const CACHE_TTL_MS = 60 * 1000;

let memoryCache = null;

function mailUser() {
  return process.env.SMTP_USER || process.env.GMAIL_USER;
}

function imapConfig() {
  const user = mailUser();
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

function cleanEntry(e) {
  const text = typeof e?.text === "string" ? e.text.trim() : "";
  if (!text) return null;
  const locations = Array.isArray(e.locations)
    ? e.locations.filter((l) => typeof l === "string")
    : [];
  return { text, locations };
}

function normalize(data) {
  const out = {};
  TYPES.forEach((t) => {
    out[t] = (Array.isArray(data?.[t]) ? data[t] : [])
      .map(cleanEntry)
      .filter(Boolean);
  });
  return out;
}

function seedData() {
  return normalize({ problems: seedProblems, solutions: seedSolutions });
}

function parseDocument(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const raw = text.slice(start, end + 1).replace(/\u00a0/g, " ");
  // Gmail may hard-wrap an edited draft; newlines are never meaningful here.
  for (const candidate of [raw, raw.replace(/\r?\n/g, " ")]) {
    try {
      return normalize(JSON.parse(candidate));
    } catch {}
  }
  return null;
}

function findTextPart(node) {
  if (!node) return null;
  if (node.type === "text/plain") return node.part || "1";
  for (const child of node.childNodes || []) {
    const found = findTextPart(child);
    if (found) return found;
  }
  return null;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function draftsPath(client) {
  const boxes = await client.list();
  return (
    boxes.find((b) => b.specialUse === "\\Drafts")?.path || "[Gmail]/Drafts"
  );
}

async function withDrafts(fn) {
  const config = imapConfig();
  if (!config) return null;
  const client = new ImapFlow(config);
  await client.connect();
  try {
    const path = await draftsPath(client);
    const lock = await client.getMailboxLock(path);
    try {
      return await fn(client, path);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function readDraft(client) {
  const uids = (await client.search({ subject: TICKER_SUBJECT }, { uid: true })) || [];
  for (const uid of [...uids].reverse()) {
    const msg = await client.fetchOne(uid, { bodyStructure: true }, { uid: true });
    const part = findTextPart(msg?.bodyStructure);
    if (!part) continue;
    const { content } = await client.download(uid, part, { uid: true });
    const data = parseDocument(await streamToString(content));
    if (data) return { data, uids };
  }
  return { data: null, uids };
}

async function writeDraft(client, path, data, oldUids) {
  const user = mailUser();
  const raw = await new MailComposer({
    from: user,
    to: user,
    subject: TICKER_SUBJECT,
    text: JSON.stringify(data, null, 2),
  })
    .compile()
    .build();
  await client.append(path, raw, ["\\Draft", "\\Seen"]);
  if (oldUids.length) await client.messageDelete(oldUids, { uid: true });
}

function readCacheFile() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function setCache(data) {
  memoryCache = { ...data, fetchedAt: Date.now() };
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache));
  } catch {}
}

async function loadData() {
  const cached = memoryCache || readCacheFile();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  try {
    const result = await withDrafts((client) => readDraft(client));
    if (result) {
      const data = result.data || seedData();
      setCache(data);
      return data;
    }
  } catch (e) {
    console.warn("Could not read ticker draft:", e.message);
  }
  return cached || seedData();
}

export async function getEntries(type) {
  if (!TYPES.includes(type)) return [];
  const data = await loadData();
  return data[type] || [];
}

export async function addEntry(type, entry) {
  const clean = cleanEntry(entry);
  if (!TYPES.includes(type) || !clean) return { ok: false };
  try {
    const saved = await withDrafts(async (client, path) => {
      const { data, uids } = await readDraft(client);
      const next = data || seedData();
      if (!next[type].some((e) => e.text === clean.text)) next[type].push(clean);
      await writeDraft(client, path, next, uids);
      return next;
    });
    if (!saved) return { ok: false, reason: "Mailbox not configured" };
    setCache(saved);
    return { ok: true };
  } catch (e) {
    console.warn("Could not update ticker draft:", e.message);
    return { ok: false, reason: e.message };
  }
}
