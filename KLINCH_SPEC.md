# KLINCH_SPEC.md
# Klinch — Full Product Specification for Claude Code
# Last updated: April 2026
# This document is the single source of truth for building Klinch.
# Read this in full before writing any code.

---

## 1. PRODUCT OVERVIEW

Klinch is a desktop application for SDR (Sales Development Representative) job candidates. It provides real-time AI-powered answer suggestions during virtual interviews (Zoom, Google Meet, Microsoft Teams), displayed as a transparent always-on-top overlay on the candidate's screen. It also functions as a complete job search operating system — from resume feedback and job discovery through to post-interview coaching and follow-up.

**Target users:** SDR candidates actively job searching
**Platform:** Desktop (Mac + Windows)
**Distribution:** Direct download from tryklinch.com
**Domain:** tryklinch.com

---

## 2. TECH STACK

### Desktop Framework
- **Electron** — cross-platform desktop app framework
- Node.js backend runs natively inside Electron
- Single codebase for Mac and Windows

### Audio Capture
- **BlackHole** (Mac) — virtual audio driver for system audio capture
- **WASAPI loopback** (Windows) — built-in Windows system audio capture
- Both route system audio (interviewer's voice from Zoom/Teams) as microphone input
- This is NON-NEGOTIABLE — the app only targets virtual interviews

### Speech to Text
- **Web Speech API** — built into Chromium/Electron, completely free
- Transcribes interviewer questions in real time
- No external STT service needed

### AI Engine
- **Anthropic Claude API** — claude-sonnet-4-6 model
- Powers: real-time answer suggestions, post-interview coaching, thank you emails, resume feedback, Dry Run interviewer simulation, Insider Tips
- Stream responses token by token for real-time teleprompter effect
- Enable prompt caching for the candidate's brain to reduce token costs by ~50%

### LinkedIn Data
- **Proxycurl** — fetch LinkedIn profile data via URL
- Use for: candidate profile (onboarding), interviewer profiles, company profiles
- Always cache results in database — never fetch the same profile twice
- Cost: ~$0.01-0.05 per lookup

### Company Intelligence
- **Apollo.io API** — company search autocomplete with logos
- **NewsAPI** — recent company news, funding, press releases
- **Glassdoor** — company ratings, interview difficulty, salary data (display only, no job listings)

### Job Discovery
- **Indeed API** — broad SDR job listings
- **Adzuna API** — additional job coverage
- **Greenhouse API** — high quality tech company roles
- **Lever API** — high quality tech company roles
- **Nooks SDR job board** — scrape https://www.nooks.ai/sdr-job-board (publicly available, curated SDR roles)
- Apply competitor blocklist to all job sources (see Section 9)

### Email + Calendar Integration
- **Gmail API** (Google OAuth 2.0) — send emails, read threads, calendar access
- **Microsoft Graph API** (Microsoft OAuth 2.0) — Outlook email + calendar
- Scope: send email, read email threads, read/write calendar events
- Both integrations share the same OAuth flow pattern

### Payments
- **Stripe** — subscription billing and pay-per-use packs
- **Stripe Tax** — enable from day one for automatic VAT/GST compliance globally
- Webhook handling for subscription events

### Database
- **Supabase** — PostgreSQL database + authentication
- Supabase Auth for user login and session management
- Store: user profiles, company CRM data, interview transcripts, job listings cache

### Development
- Language: JavaScript/Node.js throughout
- Package manager: npm
- Version control: GitHub

---

## 3. PRICING MODEL

| Plan | Price | Interview Credits | Notes |
|---|---|---|---|
| Free Trial | $0 | 3 interviews | No credit card required |
| Starter | $9.99/month | 10 interviews | Cancel anytime |
| Unlimited | $19.99/month | Unlimited | Cancel anytime |
| Pay-per-use | $1.99 | Pack of 5 | One-time purchase |

- Interview credits are consumed when a live interview session starts
- Dry Run practice sessions do NOT consume interview credits
- Credits do not roll over month to month on Starter plan
- Never cut off a user mid-interview if they run out of credits — complete the current session

---

## 4. ONBOARDING FLOW

### 4a. Account Creation
1. User downloads and opens Klinch
2. Sign up with email or Google OAuth
3. Email verification
4. Proceed to Priming Session

### 4b. Audio Setup (One-Time)
Before the priming session, walk user through audio setup:
- **Mac:** Step-by-step BlackHole installation guide with screenshots
- **Windows:** WASAPI loopback configuration guide
- Test audio capture before proceeding
- This is a one-time setup — never ask again after completion

### 4c. Priming Session (One-Time)
The priming session builds the candidate's "brain" — a compressed profile used in every Claude API call.

**Step 1 — Resume Upload**
- Accept PDF or DOCX
- Parse and extract key information
- Compress into structured profile (~300 tokens max)

**Step 2 — LinkedIn Profile**
- User pastes their LinkedIn URL
- Proxycurl fetches full profile data silently
- Compress into structured profile

**Step 3 — 10 Priming Questions**
Ask the candidate these questions and save their answers:
1. What is your proudest sales achievement and what drove it?
2. How would you describe your outbound prospecting philosophy?
3. What does your typical cold call framework look like?
4. How do you handle rejection and stay motivated?
5. What CRM and sales tools have you used and how proficient are you?
6. What industries or verticals have you sold into?
7. What is your average deal size and sales cycle length?
8. How do you research a prospect before outreach?
9. What does great SDR management look like to you?
10. Where do you want to be in your sales career in 2-3 years?

**Step 4 — Compress the Brain**
Send resume + LinkedIn + answers to Claude API with instruction to compress into a tight 600-token profile. Store this compressed profile as `candidate_brain` in the database. This is injected into every subsequent API call — never send raw resume/LinkedIn text.

### 4d. Per-Interview Setup
For each new interview the candidate adds:
1. Company name via Apollo.io autocomplete (not manual URL entry)
2. Interviewer name + LinkedIn URL → Proxycurl fetches profile → cached
3. Job description (paste text)
4. Interview stage: Recruiter Screen / Hiring Manager / Panel
5. Date and time → populates calendar

---

## 5. LIVE INTERVIEW OVERLAY

### 5a. Window Configuration
- Electron `BrowserWindow` with:
  - `alwaysOnTop: true`
  - `transparent: true`
  - `frame: false`
  - `skipTaskbar: false`
- Positioned at top of screen as close to webcam as possible
- User can drag to reposition

### 5b. Display Modes
Two modes, switchable via settings or hotkey during live interview:

**Mode 1 — Teleprompter**
- Full sentences scroll across the top of the screen
- Text streams token by token as Claude responds
- Adjustable scroll speed

**Mode 2 — Bullet Points**
- 3-4 concise talking points displayed instead of full sentences
- Same Claude call, different system prompt instruction
- Better for natural speakers who just need structure

### 5c. Customization Settings
- Scroll speed (words per minute slider)
- Font size (small / medium / large)
- Font color (white, black, yellow + custom)
- Background opacity (0% to 100%)
- Font face (clean readable options: SF Pro, Georgia, Courier)
- Display mode (Teleprompter / Bullet Points)

### 5d. Hotkeys (active during live interview)
- `Space` — pause/resume teleprompter
- `R` — replay last suggestion
- `X` or `Escape` — dismiss current suggestion
- `M` — toggle between Teleprompter and Bullet Point mode
- `↑` / `↓` — adjust scroll speed on the fly

### 5e. Answer Generation Flow
```
Interviewer speaks
→ Web Speech API transcribes in real time
→ VAD (Voice Activity Detection) detects pause/end of question
→ Trigger Claude API call with:
    - candidate_brain (cached, ~600 tokens)
    - company profile (cached)
    - interviewer profile (cached)
    - job description
    - interview stage
    - question transcript
    - display mode (teleprompter or bullets)
→ Stream response token by token to overlay
→ Save question + answer to transcript
```

### 5f. Side Panel (during interview)
Visible alongside the main Zoom window:
- Live transcript feed
- Current AI suggestion preview
- Live coach metrics: talk time ratio, filler word count, pace indicator
- Teleprompter speed control slider
- Display settings (size, opacity, color)

### 5g. Context Window Management
Total tokens per API call target: ~2,000-3,000
- `candidate_brain`: ~600 tokens (static, cached)
- Company profile: ~400 tokens (cached)
- Interviewer profile: ~300 tokens (cached)
- Job description: ~400 tokens (cached)
- Current question: ~100 tokens
- Prior interview summaries with this company: ~300-400 tokens (compressed)
Use prompt caching for all static content to reduce costs by ~50%

---

## 6. POST-INTERVIEW FEATURES

### 6a. Interview Coach
After each interview, generate a coaching report using the full transcript:
- **Filler word analysis** — count of "um", "uh", "like", "you know", "basically", "literally"
- **Talk time ratio** — what % of the conversation was the candidate speaking
- **Answer length** — average answer duration, flag answers over 3 minutes
- **Word repetition** — overused words/phrases
- **Pacing** — words per minute, flag if too fast or too slow
- **Overall score** — 0-100
- **3 specific improvement suggestions** — personalised and actionable

### 6b. Thank You Email
- Auto-generate a personalised thank you email using meeting transcript
- Reference specific topics discussed in the interview
- Candidate can edit before sending
- Send directly from Klinch via connected Gmail or Outlook
- Save sent email to company CRM email thread history

### 6c. Transcript Storage
- Full raw transcript saved to Supabase
- AI-generated summary saved (~300 tokens)
- Both accessible from company CRM tab
- Configurable auto-delete: 7 / 30 / 90 days (user preference)
- Local storage option (premium): transcripts stored on device only

---

## 7. COMPANY CRM

### 7a. Adding a Company
- Searchable autocomplete field powered by Apollo.io API
- User types company name → Apollo returns matches with logos
- User selects company → Klinch silently fetches:
  - LinkedIn company data via Proxycurl
  - Recent news via NewsAPI
  - Glassdoor insights (ratings, interview difficulty, salary)
- No manual URL input required — feels like adding a company in Salesforce

### 7b. Company Tab Contents
Each company has a dedicated tab showing:
- **Overview** — company description, size, industry, HQ, Glassdoor rating
- **Recent News** — funding, leadership changes, press releases (NewsAPI)
- **People** — interviewers met, interviewers scheduled, fetched via Proxycurl
- **Interview History** — all past interviews, transcripts, coach scores, notes
- **Upcoming Interviews** — scheduled future interviews with dates/times
- **Emails** — all email threads with this company (pulled from Gmail/Outlook)
- **Job Description** — the role being applied for

### 7c. Offer Accepted Flow
When candidate marks a company as "Offer Accepted":
1. Launch celebration screen
2. Prompt LinkedIn post with pre-written template (editable):
   > "Excited to share that I just accepted an offer as [Role] at [Company]! I used Klinch throughout my interview process — real-time AI coaching that helped me stay sharp and confident. If you're an SDR actively interviewing, check it out: [referral link] #SDR #Sales #NewJob #Klinch"
3. Candidate submits LinkedIn post URL
4. Status set to "Pending Review" — Sean manually reviews and approves
5. On approval: $10 Amazon gift card issued + referral link activated ($5 per signup)

---

## 8. JOB DISCOVERY

### 8a. New Jobs Tab
- Aggregate SDR jobs from: Indeed, Adzuna, Greenhouse, Lever, Nooks (scraped)
- Match to candidate profile: role title, location, experience level
- Apply competitor blocklist (see Section 9)
- Daily refresh
- Display: company logo, role title, location, salary (if available), source
- One-click opens job in browser

### 8b. Email Digest
- Weekly email to candidate with top 5 new matched jobs
- Sent via connected Gmail/Outlook

---

## 9. COMPETITOR BLOCKLIST

Apply this blocklist to all job discovery sources. Never surface SDR roles at these companies:
- Remote (remote.com)
- Deel
- Rippling
- Oyster HR
- Papaya Global
- Multiplier
- Velocity Global
- Globalization Partners
- Omnipresent
- Horizons

Store blocklist in database so it can be updated without a code release.

---

## 10. CALENDAR FEATURE

### 10a. Dashboard Widget
- Shows next 5 upcoming interviews sorted by date
- Each card shows: company logo, role, interviewer, date/time, "Launch Klinch" button

### 10b. Calendar Tab
- Month/week toggle view
- All interviews plotted as events
- Click event → opens company CRM tab
- Click "Launch Klinch" → starts live interview overlay

### 10c. Population Methods
1. Manual entry in Klinch during per-interview setup
2. Google Calendar sync via Google OAuth (same credentials as Gmail)
3. Outlook Calendar sync via Microsoft OAuth (same credentials as Outlook)

### 10d. Pre-Interview Reminders
- **24 hours before** — email with company intel summary, past interview notes, stage-specific tips
- **1 hour before** — email with meeting link + "Launch Klinch" button
- **5 minutes before** — in-app notification

---

## 11. LINKEDIN FEATURES

### 11a. Profile Optimisation
- User pastes their LinkedIn URL during onboarding
- Proxycurl fetches full profile
- Claude analyses against SDR hiring best practices
- Generate specific recommendations:
  - Headline optimisation
  - About section rewrite suggestions
  - Skills gap analysis vs target job descriptions
  - Achievement quantification in experience section

### 11b. Outbound Strategy
- Connection request templates for SDR hiring managers
- InMail templates
- Content suggestions to get noticed by hiring managers
- Marketing angle: "You prospect for your company all day. Why aren't you prospecting for yourself?"

### 11c. Organic Growth Mechanic
- Active subscribers can post about Klinch on LinkedIn
- Submit post URL inside app → "Pending Review" status
- Sean manually reviews
- On approval: 1 free month at current tier

---

## 12. OUTBOUND EMAIL FEATURES

### 12a. Cold Email to Hiring Managers
- AI-generated personalised cold emails using company CRM data
- Sent via connected Gmail or Outlook
- Tracked in company CRM: open rates, reply rates
- Follow-up sequence if no response after X days

---

## 13. DRY RUN (V2 FEATURE)

Practice interview mode — builds after V1 is live.

### Modes
1. **Generic SDR** — Claude asks standard SDR interview questions
2. **Company-Specific** — Claude uses job description, company culture, interviewer LinkedIn, and Insider Tips to simulate the real interview

### Flow
1. Candidate selects Dry Run from dashboard
2. Choose mode + interview stage (Recruiter / HM / Panel)
3. Claude plays interviewer — asks opening question
4. Candidate speaks answer via mic — Web Speech API transcribes
5. Claude listens, asks natural follow-up
6. 5-10 questions then session ends
7. Full coach report generated

### Pricing
- Unlimited Dry Runs on all paid plans
- Does NOT consume interview credits

---

## 14. NDA & RECORDING CONSENT

### Before Every Live Interview Session
Display two acknowledgements the user must accept:
1. **Recording consent:** "I confirm I have notified or will notify all participants that this session will be transcribed by Klinch for my personal coaching and review, in compliance with all applicable recording laws in my jurisdiction."
2. **NDA warning:** "If I am subject to a non-disclosure agreement in connection with this interview, I confirm that recording and storing this conversation complies with my obligations under that agreement."

Log both acceptances with timestamp in database.

### Data Controls
- Configurable transcript auto-delete: 7 / 30 / 90 days
- Local storage option (premium): transcripts on device only, not uploaded to Klinch servers
- User can manually delete any transcript at any time

---

## 15. INSIDER TIPS

Sean Egan is an SDR Manager who has interviewed hundreds of SDR candidates. His expertise is built into Klinch via:

### System Prompt Integration
Include SDR hiring manager perspective in all answer generation prompts. Answers should reflect what a hiring manager actually wants to hear — not generic interview advice.

### Tip Cards
Short punchy insights displayed in the app before interviews:
- What hiring managers look for in the first 30 seconds
- How to answer "what's your cold call framework" without sounding scripted
- The one answer that makes SDRs stand out
- What instantly disqualifies a candidate and how to avoid it

### Stage-Based Briefings
Before each interview, surface relevant tips based on the stage:
- **Recruiter Screen** — tips on first impressions, screening questions
- **Hiring Manager** — tips on demonstrating sales instinct and coachability
- **Panel** — tips on handling multiple interviewers

---

## 16. MEMORY ARCHITECTURE

### Two-Layer Context System
**Layer 1 — Candidate Brain (static, ~600 tokens)**
- Compressed onboarding profile: resume + LinkedIn + 10 priming answers
- Created once at onboarding, updated if candidate updates profile
- Cached via Anthropic prompt caching
- Injected into every API call

**Layer 2 — Company Interview History (dynamic)**
- Full transcript of each interview session (stored in Supabase)
- After each interview, generate compressed summary (~300-400 tokens)
- For subsequent interviews with same company, inject prior summaries
- Gets smarter per candidate per company over time — key competitive moat

**Total per API call:** ~2,000-3,000 tokens
**Storage structure:** `interview_sessions[]` array per company per candidate

---

## 17. DATABASE SCHEMA (SUPABASE)

### Tables
```
users
  - id, email, created_at, plan, interview_credits, stripe_customer_id

candidate_profiles
  - user_id, brain_compressed, resume_raw, linkedin_url, linkedin_data, priming_answers, updated_at

companies (CRM)
  - id, user_id, name, apollo_id, linkedin_url, linkedin_data, glassdoor_data, news_cache, created_at

interviewers
  - id, company_id, user_id, name, linkedin_url, linkedin_data, created_at

interviews
  - id, company_id, interviewer_id, user_id, stage, scheduled_at, status, job_description, created_at

interview_sessions
  - id, interview_id, transcript_full, transcript_summary, coach_report, started_at, ended_at, credits_used

emails
  - id, company_id, user_id, subject, body, direction (sent/received), gmail_message_id, created_at

jobs
  - id, user_id, company_name, role_title, location, salary, source, url, created_at, is_blocked

consent_logs
  - id, user_id, interview_id, recording_consent, nda_consent, timestamp
```

---

## 18. API KEYS REQUIRED

Before building, ensure these API keys are available in `.env`:

```
ANTHROPIC_API_KEY=
PROXYCURL_API_KEY=
APOLLO_API_KEY=
NEWS_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_TAX_ENABLED=true
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
INDEED_API_KEY=
ADZUNA_APP_ID=
ADZUNA_API_KEY=
GREENHOUSE_API_KEY=
LEVER_API_KEY=
```

---

## 19. FILE STRUCTURE

```
klinch/
  ├── main.js                 # Electron main process
  ├── preload.js              # Electron preload script
  ├── package.json
  ├── .env                    # API keys (never commit to GitHub)
  ├── .gitignore
  ├── KLINCH_SPEC.md          # This file
  ├── BUILD_STATUS.md         # Living build progress tracker
  │
  ├── src/
  │   ├── main/               # Main process (Node.js)
  │   │   ├── audio/          # BlackHole + WASAPI audio capture
  │   │   ├── db/             # Supabase client + queries
  │   │   ├── api/            # External API integrations
  │   │   │   ├── claude.js
  │   │   │   ├── proxycurl.js
  │   │   │   ├── apollo.js
  │   │   │   ├── newsapi.js
  │   │   │   ├── stripe.js
  │   │   │   ├── gmail.js
  │   │   │   ├── outlook.js
  │   │   │   ├── jobs/
  │   │   │   │   ├── indeed.js
  │   │   │   │   ├── adzuna.js
  │   │   │   │   ├── greenhouse.js
  │   │   │   │   ├── lever.js
  │   │   │   │   └── nooks.js
  │   │   ├── ipc/            # IPC handlers (main ↔ renderer)
  │   │   └── services/       # Business logic
  │   │       ├── brain.js    # Candidate brain compression
  │   │       ├── interview.js
  │   │       ├── coaching.js
  │   │       └── calendar.js
  │   │
  │   └── renderer/           # Renderer process (UI)
  │       ├── index.html      # Main app window
  │       ├── overlay.html    # Transparent interview overlay
  │       ├── css/
  │       └── js/
  │           ├── app.js
  │           ├── overlay.js
  │           ├── stt.js      # Web Speech API
  │           ├── pages/
  │           │   ├── dashboard.js
  │           │   ├── onboarding.js
  │           │   ├── interview.js
  │           │   ├── company.js
  │           │   ├── jobs.js
  │           │   ├── calendar.js
  │           │   └── coach.js
  │           └── components/
  │               ├── teleprompter.js
  │               ├── sidebar.js
  │               └── crm.js
  │
  └── assets/
      ├── icons/
      └── fonts/
```

---

## 20. BUILD PHASES

### Phase 1 — Core MVP (Weeks 1-3)
Priority: get a working interview overlay before anything else
1. Electron app scaffold
2. Transparent always-on-top overlay window
3. BlackHole (Mac) + WASAPI (Windows) audio capture
4. Web Speech API transcription
5. Claude API integration with streaming
6. Teleprompter and Bullet Point display modes
7. Basic onboarding (priming session)
8. Stripe billing (all three tiers)
9. Supabase auth + basic user profile

### Phase 2 — Company CRM (Weeks 4-5)
1. Apollo.io company autocomplete
2. Proxycurl LinkedIn fetching + caching
3. NewsAPI company news
4. Glassdoor data display
5. Company tab UI (overview, news, people, history)
6. Interview history and transcript storage

### Phase 3 — Post-Interview Tools (Weeks 6-7)
1. Interview coach report generation
2. Thank you email generation
3. Gmail OAuth integration
4. Outlook OAuth integration
5. Email threads in company tab

### Phase 4 — Jobs + Calendar (Weeks 8-9)
1. Job sources integration (Indeed, Adzuna, Greenhouse, Lever, Nooks)
2. Competitor blocklist
3. New Jobs tab UI
4. Calendar tab UI
5. Google Calendar + Outlook Calendar sync
6. Pre-interview reminders

### Phase 5 — Polish + Growth (Weeks 10-12)
1. LinkedIn profile optimisation
2. Outbound email templates
3. Offer Accepted celebration flow + gift card
4. Organic growth LinkedIn posting mechanic
5. Insider Tips content
6. Mac + Windows testing
7. Audio setup onboarding guides

---

## 21. IMPORTANT CONSTRAINTS

- **Virtual interviews only** — this app does NOT support in-person interviews
- **English only** — all STT, AI prompts, and UI in English only
- **Never cut off mid-interview** — if credits run out, complete the current session
- **Always cache Proxycurl results** — never fetch the same LinkedIn profile twice
- **Compress the brain** — never send raw resume/LinkedIn to Claude API
- **Stripe Tax enabled from day one** — non-negotiable for global compliance
- **Two consent acknowledgements required** before every live session
- **Competitor blocklist** applied to all job sources — see Section 9
- **Dark mode by default** — all UI built dark mode first

---

*End of KLINCH_SPEC.md*
