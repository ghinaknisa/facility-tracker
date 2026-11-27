# Facility Service Request System

Web-based system for submitting, tracking, and resolving campus facility complaints.

**Course:** Information Systems Agile Project Management with DevOps (IS 2026)
**Client (Case 4):** Campus Facilities Unit

## Problem
Complaints are sent through WhatsApp or verbal reports. Reporters cannot track progress, and staff cannot prioritize requests, assign work, or review unresolved issues.

## Features
| Role | What they can do |
|---|---|
| **Reporter** | Create an account, log in, submit a complaint (category, location, description, optional photo), edit or cancel it while it is still *New*, follow its status timeline |
| **Admin** | See all complaints, filter them, set priority, assign a technician, change status, delete complaints, manage categories and users, view reports |
| **Technician** | See assigned complaints and update their status (New, In Progress, Resolved) |

Pages: Home, Dashboard, Complaints, Service Requests, Reports (admin), Admin (admin).

## Tech stack
- **Frontend:** HTML5, CSS3, vanilla JavaScript (no build step)
- **Backend and database:** Supabase (PostgreSQL + Auth + Storage). Access rules are enforced by Row Level Security, not by the browser
- **CI:** GitHub Actions (lint, unit tests, build) on every push and pull request
- **Hosting:** Vercel (static site, free plan)

## Project structure
```
index.html                page shell
css/style.css             design system (cream, Cosmos Blue, red accents)
js/config.js              Supabase URL and anon key (you fill these in)
js/store.js               pure logic: validation, status rules, statistics (unit tested)
js/api.js                 all Supabase calls (Auth, database, storage)
js/app.js                 UI, routing, role-based views
supabase/schema.sql       tables, triggers, RLS policies, storage bucket, seed data
test/store.test.js        unit tests
docs/screenshots/         screenshots of the final app
postman/                  API validation collection, environment and guide
.github/workflows/ci.yml  CI pipeline
```

## Setup (about 10 minutes)
> The project `facility-service-request` is already created and `supabase/schema.sql` is already applied; `js/config.js` points to it. Follow these steps only to rebuild the backend from scratch.

1. **Create a free Supabase project** at https://supabase.com (Region: closest to you).
2. **Create the database:** Dashboard -> SQL Editor -> New query -> paste all of `supabase/schema.sql` -> Run. Run it once on a fresh project.
3. **Turn off email confirmation** (easiest for a class demo): Authentication -> Providers -> Email -> disable "Confirm email". If you keep it on, new users must confirm by email before logging in.
4. **Connect the app:** Project Settings -> API. Copy the *Project URL* and the *anon public* key into `js/config.js`. The anon key is public by design.
5. **Run locally:** open `index.html` in a browser, or run `npx serve .`
6. **Create the first admin:** register an account in the app, then in the SQL Editor run
   `update public.profiles set role = 'admin' where email = 'your-email@example.com';`
   Log in again. In the app, open **Admin -> Users** to promote other users to *technician* (or *admin*).

## Password reset (email link)
Supabase must know where to send users back. In Supabase: Authentication -> URL Configuration:
- **Site URL:** your Vercel URL (for example `https://your-app.vercel.app`)
- **Redirect URLs:** add `http://localhost:3000/**` (and any local address you use) and `https://your-app.vercel.app/**`

The default Supabase email sender is limited to a few emails per hour, which is enough for a class demo.

## Deploy to Vercel (free)
1. Push this repo to GitHub.
2. Go to https://vercel.com -> Add New -> Project -> import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty. Click Deploy.
4. Copy the live URL into the *Live Application Link* file. In Supabase, add the URL under Authentication -> URL Configuration -> Site URL.

## Tests and CI
```bash
npm run lint
npm test        # Node.js 18+
```
CI runs the same commands (see `.github/workflows/ci.yml`).

## Security notes
- Passwords are handled by Supabase Auth and never stored in this project.
- Row Level Security limits reporters to their own complaints and technicians to assigned ones. Database triggers block role escalation and invalid status changes.
- Photos go to a private bucket (JPG/PNG, max 2 MB) and are shown through short-lived signed links.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching strategy.
