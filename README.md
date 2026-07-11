# ChildPsychHR — מערכת ניהול כוח אדם ותקינה

**אגף פסיכיאטריה ילדים ונוער** · גרסה `v1.0.0`

Next.js + Firebase (Auth + Firestore) internal web app for managing department staffing quotas
(תקנים), replacing a manual Excel workbook. Core data model: Position (budget slot) / Employee
(person) / Assignment (time-bound link between the two), with a full audit trail and a
"Management Control Center" home screen for day-to-day decisions. See the in-app "אודות המערכת"
(About) screen for version history and release notes.

## Getting started

```bash
npm install
npm run dev
```

Without a `.env.local`, the app runs in a local demo mode (localStorage-backed, no Firebase
required) — see [SETUP.md](./SETUP.md) for full details on demo mode, connecting a real Firebase
project, security rules, creating the first admin account, and deploying to Vercel.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Firebase (Auth + Firestore) ·
react-hook-form + Zod · TanStack Query · ExcelJS (import/export)
