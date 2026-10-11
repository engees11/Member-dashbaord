# Team Management — Setup

## 1. Database (one time)
Supabase → SQL Editor → paste the full content of `supabase/team-management.sql` and click **Run**.

This creates:
- `team_members` — name, email, password (hash), active/inactive
- `member_activity` — who did what to which member, and when
- `members.reviewed_by` — who did the last review

## 2. Install packages
```
npm install
```
(`bcryptjs` was newly added, for password hashing.)

## 3. Env
No new env variable is needed. The `ADMIN_EMAIL` / `ADMIN_PASSWORD` login works as before — that is the main admin.

## 4. Deploy
```
git add .
git commit -m "team management"
git push
```
Vercel deploys it automatically.

## How to use
1. Admin login → **Add Member** on the dashboard → name + email.
2. The password is generated automatically and shown only once → send it to the member with **Copy WhatsApp message**.
3. The member logs in on the same login page (`/`) with their email + password.
4. Every Approve / Reject / Need Review / Delete a member does is logged.
5. A member's **View** in the sidebar shows all their activity by date.
6. Forgot password → View page → **Reset password**. To remove someone → **Deactivate** (they are logged out immediately).

## Admin vs team member
| | Admin | Team member |
|---|---|---|
| Stat cards, members list, status change | ✓ | ✓ |
| Import CSV, member delete | ✓ | ✗ |
| Team sidebar, Add Member, Reset, Deactivate | ✓ | ✗ |
| Own activity page | – | ✓ (`/admin/team/<own id>`) |

## Note
- The activity log starts from today; older actions are not recorded.
- Actions by the main admin (the .env login) are logged under the name "Admin", and they do not appear in the sidebar.
