# Facility Service Request System

Web-based system for submitting, tracking, and resolving campus facility complaints.

**Course:** Information Systems Agile Project Management with DevOps (IS 2026)
**Client (Case 4):** Campus Facilities Unit

## Problem
Complaints are sent through WhatsApp or verbal reports. Reporters cannot track progress, and staff cannot prioritize requests, assign work, or review unresolved issues.

## Solution (MVP)
Reporters submit and track complaints; admins prioritize and assign them; technicians update progress.

Sprint 1 pages: Home, Dashboard, Complaints, Service Requests, Reports, Admin (read-only views on prototype data).

## Team
| Name | Role |
|---|---|
| Ais | Scrum Master / Project Coordinator |
| Dea | Product Owner / Business Analyst |
| Ghina | Development Lead + QA / UAT |
| Tere | DevOps / Release Coordinator |

## Tech stack
- Frontend: HTML, CSS, vanilla JavaScript (Sprint 1 prototype, data kept in browser `localStorage`)
- Tests: Node.js built-in test runner (`node --test`)
- CI: GitHub Actions
- Planned: backend + database in Sprint 2

## Run locally
```bash
git clone https://github.com/<org>/facility-service-request-system.git
cd facility-service-request-system
# open index.html in a browser (or: npx serve .)
npm run lint
npm test        # requires Node.js 18+
```

**Demo accounts (prototype only):**
- Reporter: `reporter@campus.test` / `reporter123`
- Admin: `admin@campus.test` / `admin123`

## Project structure
```
index.html        page shell
css/style.css     styling
js/store.js       core logic (testable, no DOM)
js/app.js         UI rendering
test/             unit tests
.github/workflows/ci.yml   CI pipeline (GitHub Actions)
CONTRIBUTING.md   branching, commits, PR rules
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching strategy.
