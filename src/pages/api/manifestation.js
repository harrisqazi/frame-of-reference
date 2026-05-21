/**
 * POST /api/manifestation
 *
 * Sends to (when env vars are set on Vercel):
 * 1. Google Sheet — GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID
 *    (tries tab: category name, then Manifestation, then Product)
 * 2. Email — RESEND_API_KEY + RESEND_FROM → NOTIFY_EMAIL (default admin@pooly.org)
 */
import { google } from "googleapis";

const DEFAULT_NOTIFY_EMAIL = "admin@pooly.org";

function getNotifyEmail() {
  return process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_NOTIFY_EMAIL;
}

function buildEmailText(body) {
  const labels =
    body.category === "Something else"
      ? ["Name", "Email"]
      : null;

  const answerLines = (body.branchAnswers || []).map((a, i) => {
    const label = labels && labels[i] ? `${labels[i]}: ` : `Answer ${i + 1}: `;
    return `${label}${a || "(skipped)"}`;
  });

  return [
    "New Frame of Reference submission",
    "",
    `Idea: ${body.idea || ""}`,
    `Category: ${body.category || ""}`,
    "",
    ...answerLines,
    "",
    body.drawingDataUrl ? "Drawing: attached as sketch.png" : "Drawing: (skipped)",
  ].join("\n");
}

function sheetTabForCategory(category) {
  if (!category || category === "Something else") return "Other";
  return category;
}

async function appendSheetRow(body) {
  if (
    !process.env.GOOGLE_CLIENT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY ||
    !process.env.SPREADSHEET_ID
  ) {
    return { ok: false, reason: "Google Sheets env vars not configured" };
  }

  const jwt = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const row = [
    new Date().toISOString(),
    body.idea || "",
    body.category || "",
    JSON.stringify(body.branchAnswers || []),
    body.drawingDataUrl ? "yes" : "no",
  ];

  const tabs = [
    sheetTabForCategory(body.category),
    "Manifestation",
    "Product",
  ];

  let lastError = null;
  for (const range of tabs) {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [row] },
      });
      return { ok: true, tab: range };
    } catch (e) {
      lastError = e.message;
    }
  }

  return { ok: false, reason: lastError || "Could not append to sheet" };
}

async function sendResendEmail(body) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason:
        "RESEND_API_KEY not set on server — add it in Vercel Project → Settings → Environment Variables",
    };
  }

  const from =
    process.env.RESEND_FROM || "Frame of Reference <onboarding@resend.dev>";
  const to = getNotifyEmail();
  const text = buildEmailText(body);

  const payload = {
    from,
    to: [to],
    subject: "New manifestation — Frame of Reference",
    text,
  };

  if (body.drawingDataUrl && body.drawingDataUrl.includes(",")) {
    payload.attachments = [
      {
        filename: "sketch.png",
        content: body.drawingDataUrl.split(",")[1],
      },
    ];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { ok: false, reason: `Resend error: ${res.status} ${errBody}` };
  }

  return { ok: true, to };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  const sheetResult = await appendSheetRow(body);
  const emailResult = await sendResendEmail(body);

  const sheet = sheetResult.ok === true;
  const emailed = emailResult.ok === true;

  return res.status(200).json({
    ok: sheet || emailed,
    sheet,
    emailed,
    sheetTab: sheetResult.tab || null,
    notifyEmail: getNotifyEmail(),
    sheetError: sheetResult.reason || null,
    emailError: emailResult.reason || null,
    hint:
      !sheet && !emailed
        ? "Set GOOGLE_* + SPREADSHEET_ID and/or RESEND_API_KEY on Vercel. See .env.example in the repo."
        : null,
  });
}
