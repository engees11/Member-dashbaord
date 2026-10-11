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
4. `supabase/team-roles-and-delete.sql` (for Admin / Team member roles and Delete + Restore of team members)
5. `supabase/pan-number.sql` (PAN number and membership number columns)

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

## 8. Admin and Team members (roles)
- Sidebar (admin only): two sections, **Admin** and **Team members**. Both are closed until clicked. Click a name or **View** to open that person's page.
- The main admin (from `.env`) is always listed first under Admin, tagged "Main". His page shows his own work.
- On a person's page, an admin can: **Make admin / Make member**, **Deactivate / Activate**, **Delete**.
- Any number of admins is possible. An admin can make others admin. Nobody can change or delete themselves, and nobody can change the main admin.
- Role is read from the database on every request, so a change works at once. The person's dashboard refreshes the role when it opens.
- **Add Team Member** has a Role field (Team member / Admin).
- **Delete** (team members): the person is only marked as deleted. Login stops at once and they leave the sidebar. The dashboard **Deleted** card opens a page with two tables, Members and Team members, each with **Restore**.
- Adding someone with the email or number of a deleted team member points you to the Deleted list instead of creating a duplicate.
- Needs `supabase/team-roles-and-delete.sql` once. Until it is run nothing breaks: everyone is a Team member, and Make admin / Delete / admin-role just say to run it.

## 9. Where to see the OTP logs
Every OTP request prints lines starting with `[otp]` (the number is masked, the token and the OTP are never printed):
- On your computer: the terminal where `npm run dev` is running.
- On the live site: Vercel -> your project -> **Logs** (filter for `/api/otp/send`).

What the lines mean:
- `nothing sent, this number is not the admin and not an active team member` -> the number typed is not `ADMIN_PHONE` and not a saved team member. Nothing went to 11za.
- `NOT sent to 11za: WHATSAPP_OTP_TEMPLATE ... is not set` -> the setting is missing on this server (restart after editing `.env.local`, redeploy after editing Vercel).
- `sending to 11za: template=... language=...` -> the request was made to 11za.
- `11za replied HTTP ...: {...}` -> what 11za answered. A refusal also prints `11za OTP send failed`.
- `asked again too soon` / `hourly limit` -> the 60 second / 5 per hour rule.

## 10. Members: membership no., PAN, edit, export, Indian dates
- Members list has a **Mem. No.** column, and the search (page and top bar) also finds a membership number.
- **PAN** is asked in the Full Details form only (after Aadhaar number, required, 5 letters + 4 digits + 1 letter). It shows in the member's details and in the edit form. Needs `supabase/pan-number.sql` once; until then the form still saves everything except PAN.
- **Edit details** (member -> View): any logged-in team member can fix a member's details. Mobile and membership no. cannot repeat. Every edit is written to the activity log with the changed fields.
- **Add Member** and **Export** (Members page, top right) are admin only. Export gives an Excel (.xlsx) or CSV file of all members, optionally with deleted ones. Mobile and Aadhaar numbers stay whole.
- Birth date shows as **DD/MM/YYYY** everywhere (lists, details, edit form, export).
- Left menu: Dashboard, Members, Team (Admin / Team members), Deleted, Settings, Logout. Import CSV stays on the Dashboard.

