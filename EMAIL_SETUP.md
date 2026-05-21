# Email submissions to admin@pooly.org

Use **your normal Gmail** (recommended). No Resend account required.

---

## Option A: Gmail (your regular email)

The site sends mail **through your Gmail** using an **App Password** (not your normal login password).

### 1. Create a Gmail App Password

1. Use a Google account you check often (can be the same as admin@pooly.org if that’s Gmail, or any Gmail you own).
2. Turn on **2-Step Verification** for that Google account:  
   [https://myaccount.google.com/security](https://myaccount.google.com/security)
3. Go to **App passwords**:  
   [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create one named `Frame of Reference` → copy the **16-character password** (no spaces).

### 2. Add to Vercel (not GitHub)

If you already use `gmail_job_applier.py`, reuse the **same** Gmail + app password:

| Vercel variable | Same as in gmail_job_applier.py |
|-----------------|----------------------------------|
| `SMTP_USER` or `GMAIL_USER` | `GMAIL_ADDRESS` |
| `SMTP_PASS` or `GMAIL_APP_PASSWORD` | `GMAIL_APP_PASSWORD` (**remove spaces** when pasting) |
| `SMTP_HOST` | `smtp.gmail.com` (optional — auto for Gmail) |
| `SMTP_PORT` | `465` (optional — auto for Gmail; matches your script) |
| `NOTIFY_EMAIL` | `admin@pooly.org` (who receives form submissions) |

You do **not** need Resend if Gmail is set.

Optional: `SMTP_FROM` — defaults to your Gmail address (same as `GMAIL_ADDRESS`).

### 3. Redeploy

**Deployments → Redeploy** production, then submit a test form.

You should receive an email at **NOTIFY_EMAIL**. It will look like it came **from your Gmail** (Frame of Reference).

---

## Option B: Resend (optional)

Only if you prefer Resend instead of Gmail:

- `RESEND_API_KEY`
- `RESEND_FROM`
- `NOTIFY_EMAIL`

Gmail is tried **first**; Resend is only used if Gmail env vars are missing.

---

## GitHub vs Vercel

| GitHub | Vercel |
|--------|--------|
| Code only | **Put SMTP_USER and SMTP_PASS here** |
| Never commit passwords | Redeploy after saving |

---

## Email format

```
What do you want to create?
[idea]

Category:
Product

Question: What is your name?
Answer: ...

Question: What is your email?
Answer: ...
```

Drawing attached as `sketch.png` when provided.
