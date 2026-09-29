import { google } from "googleapis";
import seedProblems from "@/data/problems.json";
import seedSolutions from "@/data/solutions.json";

const SEEDS = { problems: seedProblems, solutions: seedSolutions };
const TABS = { problems: "Problems", solutions: "Solutions" };
const memory = { problems: [], solutions: [] };

function sheetsClient() {
  const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID } =
    process.env;
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
    return null;
  }
  const jwt = new google.auth.JWT(
    GOOGLE_CLIENT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  return google.sheets({ version: "v4", auth: jwt });
}

export async function getEntries(type) {
  const seed = SEEDS[type] || [];
  const sheets = sheetsClient();
  let stored = [];
  if (sheets) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: `${TABS[type]}!A:C`,
      });
      stored = (res.data.values || [])
        .filter((row) => row[1])
        .map((row) => ({
          createdAt: row[0],
          text: row[1],
          locations: (row[2] || "").split(" | ").filter(Boolean),
        }));
    } catch (e) {
      console.warn(`Could not read ${TABS[type]} tab:`, e.message);
    }
  }
  return [...seed, ...stored, ...memory[type]];
}

export async function addEntry(type, { text, locations = [] }) {
  if (!SEEDS[type] || !text?.trim()) return { ok: false };
  const entry = {
    createdAt: new Date().toISOString(),
    text: text.trim().slice(0, 280),
    locations,
  };
  memory[type].push(entry);
  const sheets = sheetsClient();
  if (!sheets) return { ok: true, persisted: false };
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: TABS[type],
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [[entry.createdAt, entry.text, locations.join(" | ")]],
      },
    });
    return { ok: true, persisted: true };
  } catch (e) {
    return { ok: true, persisted: false, reason: e.message };
  }
}
