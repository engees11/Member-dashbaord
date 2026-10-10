# OTP login for everyone (WhatsApp template), Add Team Member, status timeline

## 0. Install (once)
```
npm install
```

## 1. Database (once, in this order)
Supabase -> SQL Editor -> paste and Run:
1. `supabase/team-management.sql`
2. `supabase/otp-and-timeline.sql`
3. `supabase/soft-delete.sql` (for Delete + Restore of members)

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
| `ADMIN_NAME` | the admin's name shown in the dashboard, optional, default `Admin` |

## 4. How it works
- Login page (same for everyone): name + mobile number -> Send OTP on WhatsApp -> enter the OTP -> logged in.
- The name is only asked for. It is NOT checked. Who you are is decided by the mobile number alone, so a spelling mistake in the name never blocks a login.
- Admin: dashboard -> Add Team Member -> name, email, +91 mobile number -> Save. No OTP and no password at this step.
- OTP is valid 15 minutes (OTP_EXPIRY_MINUTES) and works once. 5 wrong tries per OTP, 10 wrong tries per number per hour. 1 new OTP per minute, 5 per hour per number.
- If the number is not registered, nothing is sent and the page shows the same message, so nobody can use it to find out who is on the team.

## 5. Emergency admin login (if WhatsApp OTP stops working)
Open `/admin-login` on your site (it is not linked anywhere) and log in with `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
Once OTP works well, remove `ADMIN_PASSWORD` from `.env.local` and Vercel to switch this off completely.

## 6. Delete and Restore (members)
- Member -> View -> **Delete member** (admin only). The member is NOT removed. It is marked as deleted and leaves all lists and counts.
- Dashboard -> **Deleted** card (admin only) -> list of deleted members with who deleted them and when -> **Restore** brings a member back with the same status and data.
- Needs `supabase/soft-delete.sql` once. Until it is run, nothing breaks, Delete just asks you to run it.
- CSV import does not bring deleted members back. A deleted member who fills the form again stays in the Deleted list until restored.

## 7. Status timeline
Member -> View shows a timeline instead of one status badge, e.g. New -> Rejected (reason) -> Approved, with who and when.
It is built from the activity log, so it starts from the day this version goes live. Delete and Restore also show up in it.
Members changed before that show only their current status.
Form submissions are also recorded in the timeline.
The status badge is still shown in the member lists (tables).

## 8. Where to see the OTP logs
Every OTP request prints lines starting with `[otp]` (the number is masked, the token and the OTP are never printed):
- On your computer: the terminal where `npm run dev` is running.
- On the live site: Vercel -> your project -> **Logs** (filter for `/api/otp/send`).

What the lines mean:
- `nothing sent, this number is not the admin and not an active team member` -> the number typed is not `ADMIN_PHONE` and not a saved team member. Nothing went to 11za.
- `NOT sent to 11za: WHATSAPP_OTP_TEMPLATE ... is not set` -> the setting is missing on this server (restart after editing `.env.local`, redeploy after editing Vercel).
- `sending to 11za: template=... language=...` -> the request was made to 11za.
- `11za replied HTTP ...: {...}` -> what 11za answered. A refusal also prints `11za OTP send failed`.
- `asked again too soon` / `hourly limit` -> the 60 second / 5 per hour rule.

