/**
 * POST /api/manifestation
 * Emails admin@pooly.org (or NOTIFY_EMAIL) when RESEND_API_KEY is set in Vercel env.
 * Optional: Google Sheets backup when GOOGLE_* env vars are set.
 */
import { google } from "googleapis";

const DEFAULT_NOTIFY_EMAIL = "admin@pooly.org";

function getNotifyEmail() {
  return (
    process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_NOTIFY_EMAIL
  );
}

function buildEmailText(body) {
  const lines = [
    "New Frame of Reference submission",
    "",
    "What do you want to create?",
    body.idea || "(skipped)",
    "",
    "Category:",
    body.category || "(not selected)",
    "",
  ];

  const questions = body.branchQuestions || [];
  const answers = body.branchAnswers || [];

  if (questions.length === 0 && answers.length === 0) {
    lines.push("(No follow-up questions for this category)", "");
  } else {
    const count = Math.max(questions.length, answers.length);
    for (let i = 0; i < count; i++) {
      lines.push(`Question: ${questions[i] || `Question ${i + 1}`}`);
      lines.push(`Answer: ${answers[i] ?? "(skipped)"}`);
      lines.push("");
    }
  }

  lines.push(
    body.drawingDataUrl
      ? "Drawing: attached as sketch.png"
      : "Drawing: (skipped)"
  );

  return lines.join("\n");
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
    return { ok: false, reason: "Google Sheets not configured" };
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
    JSON.stringify(
      (body.branchQuestions || []).map((q, i) => ({
        q,
        a: body.branchAnswers?.[i] ?? "",
      }))
    ),
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
        "RESEND_API_KEY is not set. Add it in Vercel → Settings → Environment Variables (see EMAIL_SETUP.md).",
    };
  }

  const from =
    process.env.RESEND_FROM || "Frame of Reference <onboarding@resend.dev>";
  const to = getNotifyEmail();
  const text = buildEmailText(body);

  const payload = {
    from,
    to: [to],
    subject: `New submission — ${body.idea?.slice(0, 50) || "Frame of Reference"}`,
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

  const emailResult = await sendResendEmail(body);
  const sheetResult = await appendSheetRow(body);

  const emailed = emailResult.ok === true;
  const sheet = sheetResult.ok === true;

  return res.status(200).json({
    ok: emailed || sheet,
    emailed,
    sheet,
    sentTo: emailed ? emailResult.to : null,
    sheetTab: sheetResult.tab || null,
    emailError: emailResult.reason || null,
    sheetError: sheetResult.reason || null,
    hint: !emailed
      ? "Email requires RESEND_API_KEY in Vercel (not in GitHub). See EMAIL_SETUP.md."
      : null,
  });
}
