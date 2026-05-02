# BUILD_STATUS.md
# Klinch — Build Progress Tracker
# Update this file at the end of every coding session.
# Paste the contents into Claude.ai or Claude Code at the start of each new session.

---

## Current Status
**Phase:** Phase 1 — Core MVP
**Last updated:** 2026-05-02
**Build started:** 2026-05-01

---

## Environment Setup Checklist (Updated)
- [x] ANTHROPIC_API_KEY — in .env
- [x] DEEPGRAM_API_KEY — in .env

---

## What's Built and Working
- [x] Electron app scaffold (`main.js`, `preload.js`, `package.json`)
- [x] Dark mode main window (`#08061A` background, `#7C3AFF` primary)
- [x] Frameless window with macOS `titleBarStyle: 'hiddenInset'`
- [x] Full directory structure per spec (Section 19)
- [x] CSS design system: brand colors, typography, sidebar, cards
- [x] Basic dashboard UI with sidebar navigation
- [x] `contextBridge` preload exposing `window.klinch` IPC API
- [x] Transparent always-on-top overlay window (`src/renderer/overlay.html`)
  - `transparent: true`, `frame: false`, `alwaysOnTop: 'screen-saver'`
  - Sits above fullscreen apps (Zoom, Teams) via `setVisibleOnAllWorkspaces`
  - Click-through by default; controls bar captures mouse
  - Non-focus-stealing (`focusable: false`) — Zoom mic stays active
  - Teleprompter mode: horizontal auto-scroll, speed adjustable
  - Bullet mode: up to 4 points, staggered reveal animation, window auto-resizes
  - Global hotkeys active when overlay is open: Space, R, X, Esc, M, ↑, ↓
  - "Launch Overlay" button on dashboard for testing
- [x] Live Interview pipeline — fully working end-to-end
  - **Replaced `webkitSpeechRecognition`** (doesn't work in Electron — missing Google API key) with `MediaRecorder` + Deepgram WebSocket streaming
  - **Dual-stream capture:** BlackHole 2ch (interviewer) + Mac mic (user) as two separate `getUserMedia` streams → two Deepgram WebSocket connections
  - Speaker-labelled transcripts: `Interviewer: ...` / `You: ...` displayed in live transcript panel
  - Interviewer utterances flushed to Claude for real-time coaching suggestions
  - Both streams stored as session transcript `{ speaker, text, timestamp }` for post-interview feedback
  - Deepgram `endpointing=400ms` handles VAD (replaces custom silence timer)
  - Auto-reconnect on WebSocket drop
  - Cmd+Return manual flush
  - Device status dot: green = BlackHole found, amber = fallback mic, red = error
  - Fixed broken device status IPC (was sending via `ipcRenderer.send` with no relay; switched to DOM `CustomEvent`)
- [x] Post-interview feedback infrastructure
  - `interview:transcript-entry` IPC accumulates speaker-labelled transcript in main process
  - `interview:feedback` IPC handler calls Claude with full transcript + SDR-specific feedback prompt
  - Returns structured feedback: What You Did Well / What to Improve / For Your Next Interview
  - UI for displaying feedback not yet built (backend ready)
- [x] Audio device management (`src/main/ipc/audio.js`)
  - Bundled ARM64 `audio-devices` binary (`bin/audio-devices`) — compiled from open-source Swift package, no external dependencies for end users
  - Auto-creates "Klinch Multi-Output" device (BlackHole + speakers) programmatically on first launch
  - Sets Klinch Multi-Output as system output so users hear audio normally during interviews
  - Saves and restores previous system output on interview stop
  - `audio:setup-status`, `audio:create-multi-output`, `audio:switch-for-interview`, `audio:restore-output` IPC handlers
- [x] First-launch onboarding flow (`src/renderer/js/setup.js`)
  - Blocks app until audio setup is complete
  - Step 1: Detects BlackHole; if missing, shows friendly explainer popup explaining what it is and why it's safe, then opens download page
  - Step 2: Auto-creates Klinch Multi-Output device in background — no Audio MIDI Setup required
  - Completion persisted in localStorage; re-checks on each launch in case devices were removed
  - Full new-user setup requires only one manual action: install the BlackHole pkg
- [x] Add Interview flow — 4-step modal (`src/renderer/js/add-interview.js`)
  - **Step 1 — Company Search:** Clearbit autocomplete API (free, no key required); logos via Google favicon service (`google.com/s2/favicons`); letter-initial fallback when no logo; dropdown results with click-to-select; "Change" to reset
  - **Step 2 — Interviewer:** Name + title as primary fields; optional LinkedIn URL field attempts photo fetch via NinjaPear (formerly Proxycurl); fetch silently adds photo and pre-fills name/title if empty; fully functional without LinkedIn
  - **Step 3 — Job Description:** Textarea for raw JD paste; "Process with AI" calls Claude (`claude-sonnet-4-6`) to return structured JSON; renders role title, responsibilities, must-haves, nice-to-haves; "Edit JD" to go back
  - **Step 4 — Details:** Date picker, time picker, stage selector (Recruiter Screen / Hiring Manager / Panel)
  - On completion: record saved to `localStorage`; interview card appears on dashboard immediately
  - Dashboard interview cards show: company logo, company name, role title, stage badge (colour-coded), interviewer name + initials, date + time, "Upcoming" status badge
  - Stat cards (Interviews count, Companies count) update live after each addition
- [x] `src/main/ipc/interviews-data.js` — main-process IPC handlers
  - `apollo:search` → Clearbit company autocomplete, normalised response shape
  - `proxycurl:fetch` → NinjaPear (formerly Proxycurl) LinkedIn profile enrichment; file-based cache in userData (`proxycurl-cache.json`) so same profile is never fetched twice
  - `claude:process-jd` → Claude API call; parses raw JD text into structured JSON
- [x] CSP updated: `img-src 'self' data: https:` allows external logos and profile photos
- [x] Inline `onerror` attributes replaced with JS event listeners throughout (inline handlers blocked by `script-src 'self'`); custom `_wireImgFallbacks()` utility handles img load errors across search results and interview cards

---

## What's In Progress
Nothing currently in progress.



---

## What's Next (Priority Order)
1. Post-interview feedback UI (backend already built — needs results screen)
2. Basic onboarding / priming session flow (resume, LinkedIn, 10 priming questions → candidate brain)
3. Supabase auth + user profile (migrate interviews from localStorage to Supabase)
4. Stripe billing integration
5. Interview consent acknowledgement screen (NDA + recording consent)
6. LinkedIn interviewer enrichment — NinjaPear requires active company website to sign up; alternatives: PDL (peopledatalabs.com, 1k free/month) or RapidAPI LinkedIn scrapers

---

## Known Bugs
- `AudioUnitRender() failed: -10874` logged during audio capture — sample rate mismatch between BlackHole and speakers in Multi-Output Device. Audio still works; investigate if it causes transcription gaps.

---

## Decisions Made During Build
- **Deepgram over webkitSpeechRecognition:** Electron doesn't bundle the Google API key that Chrome uses for Web Speech API, causing silent `network` errors. Deepgram WebSocket is more reliable, lower latency, and works without OS-level audio routing tricks.
- **Dual getUserMedia streams over Aggregate Device:** Capturing BlackHole and mic as separate streams gives perfect speaker attribution for post-interview feedback without needing to create an Aggregate Device in Audio MIDI Setup.
- **Bundled `audio-devices` binary over SwitchAudioSource:** SwitchAudioSource requires Homebrew (too much friction for end users). The open-source `audio-devices` Swift CLI was compiled for ARM64 and bundled in `bin/` — no install step needed.
- **`macos-audio-devices` npm package rejected:** Ships an Intel-only binary that fails on Apple Silicon without Rosetta.
- **Clearbit free autocomplete over Apollo paid search:** Apollo's `mixed_companies/search` endpoint requires a paid plan. Clearbit's `autocomplete.clearbit.com/v1/companies/suggest` is free, no auth, instant results. Logos served from `google.com/s2/favicons` (always returns something, no rate limit).
- **Manual entry as primary interviewer path:** NinjaPear (formerly Proxycurl) requires an active company website to sign up — not accessible while tryklinch.com is pre-launch. LinkedIn URL is optional and only adds a profile photo if the fetch succeeds. Manual name + title always works.
- **localStorage over Supabase for interviews:** Supabase not yet integrated. localStorage gives instant persistence for MVP without blocking the UI build. Migration to Supabase is the next major step.
- **All external API calls in main process, not renderer:** Apollo, Proxycurl/NinjaPear, and Claude calls all live in `src/main/ipc/interviews-data.js` and are invoked via IPC. Keeps API keys out of the renderer and respects `connect-src 'self'` CSP.
- **JS event listeners over inline `onerror` attributes:** `script-src 'self'` in the CSP blocks inline event handlers (`onerror="..."`). All image fallback logic uses `addEventListener('error', ...)` in JS instead.

---

## Environment Setup Checklist
- [x] Node.js installed (LTS version)
- [x] npm installed
- [x] Git installed and configured
- [x] GitHub repo created (klinch)
- [x] Cursor installed
- [x] Claude Code installed (npm install -g @anthropic-ai/claude-code)
- [x] BlackHole installed (Mac audio) — auto-handled by onboarding flow for new users
- [ ] Supabase project created
- [x] .env file created with API keys
- [x] Electron scaffold running (npm start shows a window)

---

## API Keys Status
- [x] ANTHROPIC_API_KEY
- [x] DEEPGRAM_API_KEY
- [ ] PROXYCURL_API_KEY — Proxycurl is sunset; migrated to NinjaPear (nubela.co); key in .env is invalid; NinjaPear requires active company website to sign up
- [ ] APOLLO_API_KEY — key in .env is valid but `mixed_companies/search` requires paid plan; switched to Clearbit free autocomplete instead
- [ ] NEWS_API_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] GOOGLE_CLIENT_ID + SECRET
- [ ] MICROSOFT_CLIENT_ID + SECRET
- [ ] SUPABASE_URL + KEYS
- [ ] INDEED_API_KEY
- [ ] ADZUNA_APP_ID + KEY
- [ ] GREENHOUSE_API_KEY
- [ ] LEVER_API_KEY

---

## Session Log
| Date | What was done | Time spent |
|---|---|---|
| 2026-05-01 | Electron scaffold: main.js, preload.js, package.json, CSS design system, index.html dashboard shell | ~30 min |
| 2026-05-01 | Transparent always-on-top overlay: teleprompter + bullet modes, global hotkeys, click-through, IPC wiring | ~45 min |
| 2026-05-01 | Core interview pipeline: BlackHole STT, VAD, Claude streaming, overlay states, interview panel, .env fix | ~60 min |
| 2026-05-01 | Replaced webkitSpeechRecognition with Deepgram WebSocket; dual-stream capture (BlackHole + mic); speaker-labelled transcripts; post-interview feedback infrastructure; automated audio device management with bundled ARM64 binary; first-launch onboarding flow with BlackHole explainer | ~3 hrs |
| 2026-05-02 | Add Interview 4-step modal: company search (Clearbit), interviewer (NinjaPear/manual), JD processing (Claude), date/stage details; interview cards on dashboard; main-process IPC for all external APIs; CSP fixes; img fallback via JS event listeners | ~2 hrs |

---

*Always update this file at the end of every session before closing Claude Code.*
*Paste this file's contents at the start of every new Claude.ai or Claude Code session.*
