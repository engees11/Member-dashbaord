# Team Management — Setup

## 1. Database (ek baar)
Supabase → SQL Editor → `supabase/team-management.sql` ka poora content paste karke **Run** karo.

Yeh banata hai:
- `team_members` — naam, email, password (hash), active/inactive
- `member_activity` — kaun, kab, kis member par kya kiya
- `members.reviewed_by` — last review kisne kiya

## 2. Package install
```
npm install
```
(`bcryptjs` naya add hua hai, password hash ke liye.)

## 3. Env
Koi naya env variable nahi chahiye. `ADMIN_EMAIL` / `ADMIN_PASSWORD` wala login pehle jaisa kaam karega — wahi main admin hai.

## 4. Deploy
```
git add .
git commit -m "team management"
git push
```
Vercel apne aap deploy kar dega.

## Kaise use karein
1. Admin login → dashboard par **Add Member** → naam + email.
2. Password apne aap banega aur sirf ek baar dikhega → **Copy WhatsApp message** se member ko bhej do.
3. Member usi login page (`/`) par apne email + password se login karega.
4. Member jo bhi Approve / Reject / Need Review / Delete karega, sab log hoga.
5. Sidebar mein member ke **View** se uski poori activity date ke hisaab se dikhegi.
6. Password bhool gaya → View page → **Reset password**. Kisi ko hatana hai → **Deactivate** (turant logout ho jaata hai).

## Admin vs team member
| | Admin | Team member |
|---|---|---|
| Stat cards, members list, status change | ✓ | ✓ |
| Import CSV, member delete | ✓ | ✗ |
| Team sidebar, Add Member, Reset, Deactivate | ✓ | ✗ |
| Apna activity page | – | ✓ (`/admin/team/<apna id>`) |

## Note
- Activity log aaj se shuru hoga; purane actions ka record nahi hai.
- Main admin (.env wala) ke actions "Admin" naam se log hote hain, woh sidebar mein nahi dikhta.
