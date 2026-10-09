# OTP login for everyone (WhatsApp template), Add Member, status timeline

## 0. Install (once)
```
npm install
```

## 1. Database (once, in this order)
Supabase -> SQL Editor -> paste and Run:
1. `supabase/team-management.sql`
2. `supabase/otp-and-timeline.sql`

## 2. WhatsApp OTP template (11za)
Create ONE template in 11za (type AUTHENTICATION / OTP). It is used for every member, the app fills in a new OTP each time.
Note down its exact **name** and **language code** (for example `opt` and `en`).

After it is approved, add in `.env.local` AND Vercel -> Settings -> Environment Variables (then redeploy):

| Name | Value |
|---|---|
| `WHATSAPP_OTP_TEMPLATE` | the exact template name from 11za |
| `WHATSAPP_OTP_LANGUAGE` | the language code of the template, default `en` |
| `OTP_EXPIRY_MINUTES` | optional, 1-90, default **15**. Keep it the same as the "expiry for code" you set in the template |

`WHATSAPP_TOKEN` and `ORIGIN_WEBSITE` are already there and are reused.

The app sends the OTP as the message variable AND as the button value (the Copy Code button of an Authentication template).
Not yet checked against a live 11za account: test once after the template is approved.

Testing on your own computer before the template is approved: leave `WHATSAPP_OTP_TEMPLATE` out of `.env.local`.
The OTP is then printed in the terminal where `npm run dev` runs. It is never printed on Vercel (production).

If WhatsApp does not accept the message, the terminal / Vercel logs show `11za OTP send failed: <status> <reply>` (the token is never logged).

Optional: SMS instead of WhatsApp (`OTP_CHANNEL=sms`, `SMS_PROVIDER=fast2sms|msg91|2factor`, `SMS_API_KEY`, `SMS_TEMPLATE_ID`). Not needed for the WhatsApp template.

## 3. Who the admin is (.env)
Everybody logs in with the same OTP form, the admin too. Add these in `.env.local` AND Vercel, then redeploy:

| Name | Value |
|---|---|
| `ADMIN_PHONE` | the admin's 10-digit mobile number (must have WhatsApp) |
| `ADMIN_NAME` | the admin's name, optional, default `Admin` |

## 4. How it works
- Login page (same for everyone): name + mobile number -> Send OTP on WhatsApp -> enter the OTP -> logged in.
- Admin: dashboard -> Add Member -> name, email, +91 mobile number -> Save. No OTP and no password at this step.
- The name typed at login must match the saved one (capital/small letters don't matter, the first name alone is enough).
- OTP is valid 15 minutes (OTP_EXPIRY_MINUTES) and works once. 5 wrong tries per OTP, 10 wrong tries per number per hour. 1 new OTP per minute, 5 per hour per number.
- If the name/number does not match anybody, nothing is sent and the page shows the same message, so nobody can use it to find out who is on the team.

## 5. Emergency admin login (if WhatsApp OTP stops working)
Open `/admin-login` on your site (it is not linked anywhere) and log in with `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
Once OTP works well, remove `ADMIN_PASSWORD` from `.env.local` and Vercel to switch this off completely.

## 6. Status timeline
Member -> View shows a timeline instead of one status badge, e.g. New -> Rejected (reason) -> Approved, with who and when.
It is built from the activity log, so it starts from the day this version goes live.
Members changed before that show only their current status.
Form submissions are also recorded in the timeline.
The status badge is still shown in the member lists (tables).
