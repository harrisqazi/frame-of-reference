# Email submissions to admin@pooly.org

The site sends you an email on every submission with this format:

```
What do you want to create?
[their idea]

Category:
Product

Question: What is the problem you are trying to solve?
Answer: ...

Question: What is your name?
Answer: ...
```

## GitHub vs Vercel

| Where | What |
|--------|------|
| **GitHub** | Stores the code only. You cannot put email passwords or API keys here (they would be public). |
| **Vercel** | Runs the live site. **You must add secrets here** so `/api/manifestation` can send mail. |

After you add variables in Vercel, click **Redeploy** so the live site picks them up.

## Setup (about 10 minutes) — Resend

1. Sign up at [https://resend.com](https://resend.com) (free tier is fine).
2. Create an API key: **API Keys → Create**.
3. In [Vercel](https://vercel.com), open your **frame-of-reference** project.
4. Go to **Settings → Environment Variables** and add:

| Name | Value |
|------|--------|
| `RESEND_API_KEY` | `re_...` (your Resend API key) |
| `RESEND_FROM` | `Frame of Reference <onboarding@resend.dev>` *(for testing)* or your verified domain later |
| `NOTIFY_EMAIL` | `admin@pooly.org` |

5. **Deployments → … → Redeploy** the latest production deployment.
6. Submit a test on the live site. You should receive email at **admin@pooly.org**.

### Resend testing note

With `onboarding@resend.dev` as the sender, Resend may only deliver to the email address you used to sign up for Resend until you verify a custom domain. For production, verify a domain in Resend and set:

`RESEND_FROM=Frame of Reference <notifications@yourdomain.com>`

## Optional: Google Sheets backup

If you already use Google Sheets from the old forms, you can also set:

- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `SPREADSHEET_ID`

Submissions will append to a sheet tab as well as email (when Resend is configured).
