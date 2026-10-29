# nearbase-preschool-finder

# NearBase Preschool Finder

**Empowering military families to find the right preschool — wherever the military takes them.**

---

## Source of truth

The live site (checked against the 2026-10-28 deploy archive) is this repository:

```
site/                 # Netlify publish directory
netlify/functions/    # password-protected founder dashboard (admin.mjs + admin.html)
netlify.toml          # publish = "site", /admin redirects to the function
scripts/test-match.js # node scripts/test-match.js
```

Family match math lives in `site/match.js`. Plain-language tour notes live in `site/insights.js`. Both run in the browser. No API key.

## What This Is

NearBase is an AI-powered preschool finder built specifically for military families navigating PCS moves. Finding a quality preschool in a new city — with weeks of notice, two young children, and a deployment on the horizon — is one of the most stressful parts of military family life. NearBase solves that.

The platform combines a 140+ data point matching algorithm, real-time community-verified waitlist data, and an interactive neighborhood map to surface the right preschool for each family's specific situation in minutes instead of the 40-60 hours the average military family currently spends searching.

**This repository documents the full build journey — living documents, school data, market research, prototypes, and weekly progress updates.**

---

## The Brand Roadmap

| Phase | Brand | Audience | Timeline |
|---|---|---|---|
| Phase 1 | NearBase Preschool Finder | Military families — PCS, active duty, spouses | Now — Year 2 |
| Phase 2 | NearBurrow Preschool Finder | All relocating families — military + civilian | Year 3 |

---

## The Core Insight — The Paid-Forward Intelligence Loop

Military families spend 40-60 hours researching preschools during a PCS move. Every phone call, every tour, every waitlist response contains intelligence that the next family desperately needs. NearBase captures that effort and pays it forward.

> *"AI won't know what is behind closed doors at these preschools. But military families who inquire will."* — Kelly Brown, Founder

---

## What's In This Repository

```
nearbase/
├── living-document/        # Versioned living project documents (v1.0 through current)
├── data/                   # School databases — NCR, Fort Bragg, and growing
│   ├── ncr-schools.csv
├── research/               # Market research, zone maps, program type breakdowns
├── prototypes/             # Screenshots and demos of the working prototype
├── pitch/                  # Pitch deck, founder story, investor materials
└── updates/                # Weekly progress logs
```

---

## Current Status

- ✅ Brand locked — NearBase → NearBurrow
- ✅ Domains secured — nearbase.net (MVP) + nearburrow.com (Year 3)
- ✅ 38 schools in database — NCR market, 29 fields each
- ✅ Airtable database live
- ✅ Webflow account + template selected
- ✅ Voiceflow account created
- ✅ Google Workspace — kelly@nearbase.net
- ✅ Interactive prototype built — search, Match Score, AI chatbot, ecosystem map
- ✅ Living document — v5.1
- 🔄 In progress — Webflow site build, Voiceflow chatbot scripts
- ⬜ Next — First outreach calls to school directors and military realtors

---

## The Founder

**Kelly Brown** — Former classroom teacher and military spouse.

*Every child accelerates with a personalized early educational program.*

The NearBase Preschool Finder exists because of direct, present-day knowledge of these schools — the directors by name, the culture of the classrooms, which programs will embrace a military family mid-year and which ones won't. That knowledge shouldn't live in one place. It should be in the hands of every family that needs it.

📧 kelly@nearbase.net
🌐 nearbase.net

---

## Weekly Updates

Progress updates are logged in `/updates/` — one file per week. Each entry covers what was built, what was decided, what's next, and any new schools added to the database.

---

*NearBase is currently in active build phase. Follow this repository to watch the project develop in real time.*
