/**
 * POST /api/manifestation
 *
 * Email (pick one in Vercel):
 * 1. Your normal Gmail — SMTP_USER + SMTP_PASS (Gmail App Password)  ← easiest
 * 2. Resend — RESEND_API_KEY (optional fallback)
 *
 * Submissions go to NOTIFY_EMAIL (default admin@pooly.org).
 */
import { google } from "googleapis";
import nodemailer from "nodemailer";
import {
  ENTRY_HEADER,
  ENTRY_SEARCH_TOKEN,
  entryHeader,
  rememberEntry,
} from "@/lib/entries";

function listEntryFor(body) {
  const text = body.listEntry?.text?.trim();
  if (!text) return null;
  return {
    type: body.kind === "solution" ? "solutions" : "problems",
    entry: {
      text: text.slice(0, 280),
      locations: body.listEntry.locations || [],
      createdAt: new Date().toISOString(),
    },
  };
}

const DEFAULT_NOTIFY_EMAIL = "admin@pooly.org";

function getNotifyEmail() {
  return (
    process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_NOTIFY_EMAIL
  );
}

export const config = {
  api: { bodyParser: { sizeLimit: "4.5mb" } },
};

function kindLabel(body) {
  return body.kind === "solution" ? "Solution" : "Problem that needs a solution";
}

function subjectFor(body) {
  const first = body.answers?.find((a) => a.answer)?.answer || "";
  return `New ${body.kind || "submission"} — ${first.slice(0, 50) || "Frame of Reference"}`;
}

function buildEmailText(body) {
  const lines = [
    "New Frame of Reference submission",
    "",
    `Type: ${kindLabel(body)}`,
    "",
  ];

  (body.answers || []).forEach(({ question, answer }) => {
    lines.push(`Question: ${question}`);
    lines.push(`Answer: ${answer || "(skipped)"}`);
    lines.push("");
  });

  const c = body.contact || {};
  lines.push(
    "Contact:",
    `Name: ${[c.firstName, c.lastName].filter(Boolean).join(" ") || "(none)"}`,
    `Email: ${c.email || "(none)"}`,
    `Phone: ${c.phone || "(none)"}`,
    ""
  );

  if (body.kind === "solution") {
    lines.push(
      body.ndaImages?.length
        ? "NDA: signed — attached as nda-agreement.png and nda-signature.png"
        : "NDA: not required (disclosure allowed)"
    );
  }
  lines.push(
    body.drawingDataUrl ? "Drawing: attached as sketch.png" : "Drawing: (none)"
  );
  if (body.files?.length) {
    lines.push(`Uploaded files: ${body.files.map((f) => f.name).join(", ")}`);
  }

  if (body.listEntry?.text) {
    lines.push(
      "",
      `${ENTRY_SEARCH_TOKEN} — added to the ${
        body.kind === "solution" ? "solutions" : "problems"
      } ticker. Delete this email to remove it.`
    );
  }

  return lines.join("\n");
}

function dataUrlParts(dataUrl) {
  if (!dataUrl || !dataUrl.includes(",")) return null;
  const [meta, data] = dataUrl.split(",");
  const type = meta.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  return { type, data };
}

function collectAttachments(body) {
  const list = [];
  const push = (filename, dataUrl) => {
    const parts = dataUrlParts(dataUrl);
    if (parts) list.push({ filename, ...parts });
  };
  (body.ndaImages || []).forEach((img) => push(img.name, img.dataUrl));
  push("sketch.png", body.drawingDataUrl);
  (body.files || []).forEach((f) => push(f.name, f.dataUrl));
  return list;
}

function getSmtpConfig() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  const isGmail = user.includes("@gmail.com");
  const host = process.env.SMTP_HOST || (isGmail ? "smtp.gmail.com" : "smtp.gmail.com");
  // gmail_job_applier.py uses SMTP_SSL on port 465
  const port = Number(process.env.SMTP_PORT || (isGmail ? 465 : 587));

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from: process.env.SMTP_FROM || user,
  };
}

function getMailAttachments(body) {
  return collectAttachments(body).map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.data, "base64"),
    contentType: a.type,
  }));
}

async function sendSmtpEmail(body) {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return {
      ok: false,
      reason:
        "Gmail not configured. Set SMTP_USER + SMTP_PASS in Vercel (see EMAIL_SETUP.md).",
    };
  }

  const to = getNotifyEmail();
  const text = buildEmailText(body);

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    });

    await transporter.sendMail({
      from: `"Frame of Reference" <${smtp.from}>`,
      to,
      subject: subjectFor(body),
      text,
      attachments: getMailAttachments(body),
      headers: body.entryHeader ? { [ENTRY_HEADER]: body.entryHeader } : {},
    });

    return { ok: true, to, method: "gmail" };
  } catch (e) {
    return { ok: false, reason: `Gmail SMTP error: ${e.message}` };
  }
}

async function sendResendEmail(body) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, reason: "Resend not configured" };
  }

  const from =
    process.env.RESEND_FROM || "Frame of Reference <onboarding@resend.dev>";
  const to = getNotifyEmail();
  const text = buildEmailText(body);

  const payload = {
    from,
    to: [to],
    subject: subjectFor(body),
    text,
  };

  const attachments = collectAttachments(body);
  if (attachments.length) {
    payload.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.data,
    }));
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

  return { ok: true, to, method: "resend" };
}

async function sendSubmissionEmail(body) {
  const smtpResult = await sendSmtpEmail(body);
  if (smtpResult.ok) return smtpResult;

  const resendResult = await sendResendEmail(body);
  if (resendResult.ok) return resendResult;

  return {
    ok: false,
    reason: smtpResult.reason || resendResult.reason,
  };
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

  const c = body.contact || {};
  const row = [
    new Date().toISOString(),
    kindLabel(body),
    JSON.stringify(body.answers || []),
    [c.firstName, c.lastName].filter(Boolean).join(" "),
    c.email || "",
    c.phone || "",
    body.drawingDataUrl ? "yes" : "no",
    body.ndaImages?.length ? "NDA signed" : "",
  ];

  const tabs = ["Manifestation", "Product"];

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  const listed = listEntryFor(body);
  if (listed) body.entryHeader = entryHeader(listed.type, listed.entry);

  const emailResult = await sendSubmissionEmail(body);
  if (listed && emailResult.method === "gmail") {
    rememberEntry(listed.type, listed.entry);
  }
  const sheetResult = await appendSheetRow(body);

  const emailed = emailResult.ok === true;
  const sheet = sheetResult.ok === true;

  return res.status(200).json({
    ok: emailed || sheet,
    emailed,
    sheet,
    method: emailResult.method || null,
    sentTo: emailed ? emailResult.to : null,
    sheetTab: sheetResult.tab || null,
    emailError: emailResult.reason || null,
    sheetError: sheetResult.reason || null,
    hint: !emailed
      ? "Set SMTP_USER + SMTP_PASS (Gmail app password) in Vercel. See EMAIL_SETUP.md."
      : null,
  });
}
