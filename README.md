# Intervyou AI

An AI-powered mock interview preparation, resume intelligence, and job discovery web platform built with React, TypeScript, Express, Firebase, and Gemini AI.

---

## Features

- **AI Mock Interview Room**
  - Customizable interviews across **Private** and **Government** sectors, difficulty levels (`Beginner`, `Intermediate`, `Advanced`), rounds (`Technical`, `HR`, `Behavioral`, `Coding`, `Resume-based`, `Mixed`), and multiple languages (`English`, `Telugu`, `Hindi`).
  - Interactive interview workspace supporting voice/speech transcript, live typing, question repeat/skip, and automatic answer evaluation.
- **Performance Analytics & PDF Reports**
  - Comprehensive session reports with overall readiness scores, competency progress bars, radar skill-gap matrix, trend charts, and question-by-question feedback with ideal model answers.
  - Executive **Performance Overview** tracking completed sessions, average score, personal best, answer accuracy, skill progression radar, and weekly activity heatmap.
  - One-click **Download PDF** generation powered by `jsPDF` for individual interview reports, overall performance summaries, and interview history logs.
- **Resume Workspace & AI Strength Meter**
  - Upload and preview `PDF`, `DOC`, `DOCX`, and `TXT` resumes (up to 10 MB) with automatic text extraction.
  - **AI Resume Strength Meter** & **ATS Score Analyzer** benchmarking your resume against target roles and industry keywords with actionable improvement suggestions.
- **Ongoing Job Search & Quick Apply**
  - Browse ongoing Private (LinkedIn/Naukri) and Government/PSU openings filtered by **Industry**, **Job Type** (`Full-time` / `Internship`), **Sector**, **Experience**, and **Location** (automatically excludes expired deadlines).
  - **Quick Apply** modal that auto-populates your application intent and matched skills using your uploaded resume and profile.
  - Integrated **Salary Estimator**, **Saved Jobs** tracker, and **Email Job Alerts** subscription based on saved resume skills in Settings.
- **Authentication & Cloud Persistence**
  - Supports **Google Sign-In** (Firebase Authentication) and email/password authentication.
  - Real-time **Cloud Firestore** persistence (`users`, `interviews`, `savedJobs`, `applications`) synchronized with the Express backend and enforced by strict owner-isolated `firestore.rules`.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Recharts, Motion, Lucide React, jsPDF
- **Backend:** Node.js, Express (`server.ts`), Multer, `pdf-parse`, `mammoth`
- **AI & Cloud:** `@google/genai`, Firebase Authentication, Cloud Firestore

---

## Environment Files (`.env` & `.env.example`)

- **Template file:** `./.env.example` (located in the repository root and tracked in Git).
- **Local secrets file:** `./.env` (create this in the repository root by copying `.env.example` — **never commit `.env`**, as `.gitignore` excludes `.env*` while keeping `!.env.example`).

```bash
cp .env.example .env
```

`server.ts` loads `.env` automatically on startup via `dotenv.config()`.

| Variable | File / Scope | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `GEMINI_API_KEY` | `.env` (Server) | Yes (for live AI) | — | Google Gemini API key used server-side for question generation, answer evaluation, report insights, and resume strength analysis. If omitted, the server falls back to local mock responses. |
| `APP_URL` | `.env` (Server) | No | `http://localhost:3000` | Base URL where the app is hosted. |
| `PORT` | `.env` (Server) | No | `3000` | HTTP port for the Express + Vite server. |
| `NODE_ENV` | `.env` (Server) | No | `development` | Set to `production` when serving the built `dist/` bundle via `npm start`. |
| `VITE_API_URL` | `.env` (Client) | No | `/api` | Optional base URL override for frontend API requests. |
| `DISABLE_HMR` | `.env` (Vite) | No | `false` | Set to `true` to disable Vite Hot Module Replacement and file watching. |

### Other Configuration & Runtime Files
- **`./firebase-applet-config.json`** (root): Client-side Firebase project, Auth domain, API key, and Firestore database ID configuration loaded by `src/firebase.ts`.
- **`./firestore.rules`** & **`./firebase-blueprint.json`** (root): Owner-isolated Cloud Firestore security rules and schema blueprint.
- **`./instance/`** (created automatically at runtime, ignored by Git): Stores local fallback persistence (`instance/db.json`) and uploaded resume files (`instance/uploads/`).

---

## Getting Started

### 1. Prerequisites
- Node.js **20+**
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up `.env`
```bash
cp .env.example .env
# Edit .env in the project root and set GEMINI_API_KEY
```

### 4. Run in Development
Starts the Express server with Vite middleware on port `3000`:
```bash
npm run dev
```

### 5. Build & Run for Production
```bash
npm run build
npm start
```

### 6. Type Check & Rules Lint
```bash
npm run lint
npx eslint firestore.rules
```

---

## Project Structure

```text
├── .env.example                # Environment variable template (copy to ./.env locally)
├── .gitignore                  # Excludes node_modules, dist, .env*, and runtime instance/
├── server.ts                   # Express API server, auth/session handling, Gemini integration & Vite dev entry
├── firestore.rules             # Owner-isolated Cloud Firestore security rules
├── firestore.rules.test.ts     # Security rule adversarial test cases
├── firebase-blueprint.json     # Firestore data schema blueprint
├── firebase-applet-config.json # Firebase Web & Firestore configuration
├── eslint.config.mjs           # ESLint flat config including @firebase/eslint-plugin-security-rules
├── package.json                # Project scripts and dependencies
├── index.html                  # HTML entry point
├── vite.config.ts              # Vite + Tailwind configuration
├── public/                     # Static assets
└── src/
    ├── App.tsx                 # Application router & authenticated sidebar layout
    ├── firebase.ts             # Firebase App, Auth, and Firestore initialization
    ├── types.ts                # Shared TypeScript domain interfaces
    ├── hooks/                  # Global app & Firebase sync state (useAppState)
    ├── pages/                  # Dashboard, Interview Setup/Room, Performance, History, MyResume, Job Search, Saved Jobs, Profile, Settings
    ├── components/             # Reusable UI widgets, ATS/Resume Strength meters, Quick Apply & Salary modals
    ├── services/               # Firestore sync helpers and live job data services
    └── utils/                  # API client, jsPDF exporters, image compressor, validators
```
