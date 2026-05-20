/**
 * Saves submission and optionally emails admin@pooly.org.
 * Email: set RESEND_API_KEY and RESEND_FROM (verified domain in Resend).
 * Sheet: reuses same Google Sheets env as /api/submit if configured.
 */
import { google } from "googleapis";

const ADMIN = "admin@pooly.org";

function buildEmailText(body) {
  const lines = [
    "New Frame of Reference submission",
    "",
    `Idea: ${body.idea || ""}`,
    `Category: ${body.category || ""}`,
    "",
    ...(body.branchAnswers || []).map(
      (a, i) => `Answer ${i + 1}: ${a}`
    ),
    "",
    body.drawingDataUrl ? "Drawing: attached as sketch.png" : "Drawing: (skipped)",
  ];
  return lines.join("\n");
}

async function appendSheetRow(body) {
  if (
    !process.env.GOOGLE_CLIENT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY ||
    !process.env.SPREADSHEET_ID
  ) {
    return null;
  }
  const target = ["https://www.googleapis.com/auth/spreadsheets"];
  const jwt = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    target
  );
  const sheets = google.sheets({ version: "v4", auth: jwt });
  const row = [
    new Date().toISOString(),
    body.idea || "",
    body.category || "",
    JSON.stringify(body.branchAnswers || []),
    body.drawingDataUrl ? "yes" : "no",
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Manifestation",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [row] },
  });
  return true;
}

async function sendResendEmail(body) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.RESEND_FROM || "Frame of Reference <onboarding@resend.dev>";
  const text = buildEmailText(body);

  const payload = {
    from,
    to: [ADMIN],
    subject: "New manifestation — Frame of Reference",
    text,
  };

  const comma = body.drawingDataUrl && body.drawingDataUrl.includes(",");
  if (comma) {
    const b64 = body.drawingDataUrl.split(",")[1];
    payload.attachments = [{ filename: "sketch.png", content: b64 }];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  let sheetOk = false;
  let emailed = false;

  try {
    await appendSheetRow(body);
    sheetOk = true;
  } catch (e) {
    console.error("manifestation sheet:", e.message);
  }

  try {
    emailed = await sendResendEmail(body);
  } catch (e) {
    console.error("manifestation email:", e.message);
  }

  return res.status(200).json({
    ok: true,
    sheet: sheetOk,
    emailed,
  });
}
