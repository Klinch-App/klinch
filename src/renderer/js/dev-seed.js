(() => {
  const devSection = document.getElementById('st-dev-section');
  if (!window.klinch?.isDev) {
    devSection?.remove();
    return;
  }

  if (devSection) devSection.style.display = '';

  document.getElementById('st-seed-btn')?.addEventListener('click', () => {
    window.KModal.confirm(
      'Load seed data?',
      'This will wipe all existing Klinch data and replace it with seed data.',
      () => { _load(); location.reload(); },
      { confirmLabel: 'Continue' }
    );
  });

  document.getElementById('st-screenshot-btn')?.addEventListener('click', () => {
    window.KModal.confirm(
      'Load screenshot data?',
      'This will wipe all existing Klinch data and replace it with screenshot data.',
      () => { _loadScreenshot(); location.reload(); },
      { confirmLabel: 'Continue' }
    );
  });

  document.getElementById('st-reset-welcome-btn')?.addEventListener('click', () => {
    localStorage.removeItem('klinch_welcome_seen');
    localStorage.removeItem('klinch_profile');
    localStorage.removeItem('klinch_dev_auth_bypass');
    location.reload();
  });

  function _uuid() { return crypto.randomUUID(); }

  function _daysFromNow(n) {
    const d = new Date(Date.now() + n * 86400000);
    return d.toISOString();
  }

  function _dateStr(n) {
    const d = new Date(Date.now() + n * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function _scheduledAt(daysOffset, hour) {
    const d = new Date(Date.now() + daysOffset * 86400000);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  function _load() {
    // Clear all existing klinch data (preserve dev auth bypass so reload doesn't show login)
    Object.keys(localStorage)
      .filter(k => k.startsWith('klinch') && k !== 'klinch_dev_auth_bypass')
      .forEach(k => localStorage.removeItem(k));

    // ── IDs ────────────────────────────────────────────────────────────────────
    const IV_SF      = _uuid();
    const IV_SF_HM   = _uuid();
    const IV_HB      = _uuid();
    const IV_HB_RS   = _uuid();
    const IV_OUT     = _uuid();
    const IV_OUT_RS  = _uuid();
    const IV_OUT_HM  = _uuid();
    const IV_GONG    = _uuid();
    const IV_GONG_RS = _uuid();
    const AP_SF   = _uuid();
    const AP_HB   = _uuid();
    const AP_OUT  = _uuid();
    const AP_GONG = _uuid();
    const DR_ID      = _uuid();
    const DR_ID_SF   = _uuid();
    const DR_ID_GONG = _uuid();

    // ── Company objects ────────────────────────────────────────────────────────
    const _logoKey = window.klinch?.logoDevKey || '';
    const _logo = (domain) => `https://img.logo.dev/${domain}?token=${_logoKey}`;

    const SALESFORCE = {
      name: 'Salesforce',
      domain: 'salesforce.com',
      primary_domain: 'salesforce.com',
      logo_url: _logo('salesforce.com'),
    };
    const HUBSPOT = {
      name: 'HubSpot',
      domain: 'hubspot.com',
      primary_domain: 'hubspot.com',
      logo_url: _logo('hubspot.com'),
    };
    const OUTREACH = {
      name: 'Outreach',
      domain: 'outreach.io',
      primary_domain: 'outreach.io',
      logo_url: _logo('outreach.io'),
    };
    const GONG = {
      name: 'Gong',
      domain: 'gong.io',
      primary_domain: 'gong.io',
      logo_url: _logo('gong.io'),
    };

    // ── Interviews ─────────────────────────────────────────────────────────────
    const interviews = [
      {
        id: IV_SF,
        process_id: AP_SF,
        company: SALESFORCE,
        interviewers: [{ name: 'Rachel Kim', title: 'Senior Recruiter', linkedin_url: '' }],
        jd: {
          raw: 'Salesforce is hiring SDRs to join our Commercial Sales team...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Generate pipeline through outbound prospecting via calls, emails, and LinkedIn',
              'Qualify inbound leads and route to Account Executives',
              'Maintain accurate CRM data in Salesforce',
              'Hit monthly meeting-set quotas',
            ],
            must_have: [
              '0–2 years of sales or customer-facing experience',
              'Excellent written and verbal communication',
              'Comfortable with high-volume outreach (80+ touchpoints/day)',
              'Salesforce CRM familiarity',
            ],
            nice_to_have: [
              'Experience with Outreach or Salesloft',
              'Prior SaaS sales exposure',
            ],
            location: 'San Francisco, CA (Hybrid)',
            salary: '$55,000–$65,000 base + commission',
          },
        },
        stage: 'Recruiter Screen',
        format: 'Virtual',
        scheduled_at: _scheduledAt(1, 10),
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-14),
      },
      {
        id: IV_HB,
        process_id: AP_HB,
        company: HUBSPOT,
        interviewers: [
          { name: 'Marcus Torres', title: 'SDR Manager', linkedin_url: '' },
          { name: 'Priya Nair', title: 'Account Executive', linkedin_url: '' },
        ],
        jd: {
          raw: 'HubSpot is looking for driven SDRs to join our fast-growing inbound sales team...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Convert marketing-qualified leads into qualified sales opportunities',
              'Run targeted outbound sequences for key verticals',
              'Collaborate closely with AEs on account strategy',
              'Exceed monthly SQL targets',
            ],
            must_have: [
              'Passion for technology and sales',
              'Strong written communication and email copywriting skills',
              'Resilient and coachable attitude',
              'Experience or familiarity with CRM tools',
            ],
            nice_to_have: [
              'HubSpot CRM knowledge',
              'Experience in a startup or scale-up environment',
            ],
            location: 'Remote (US)',
            salary: '$50,000–$60,000 base + OTE $80,000',
          },
        },
        stage: 'Hiring Manager',
        format: 'Virtual',
        scheduled_at: _scheduledAt(3, 14),
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-21),
      },
      {
        id: IV_OUT,
        process_id: AP_OUT,
        company: OUTREACH,
        interviewers: [{ name: 'Jamie Chen', title: 'VP of Sales', linkedin_url: '' }],
        jd: {
          raw: 'Outreach is hiring SDRs who are passionate about the sales process itself...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Own top-of-funnel pipeline for the Mid-Market segment',
              'Run multi-channel outbound sequences using Outreach platform',
              'Research target accounts and personalize messaging',
              'Partner with AEs to develop territory strategy',
            ],
            must_have: [
              '1+ year of B2B sales or SDR experience',
              'Demonstrated ability to exceed activity-based targets',
              'Strong prospecting and research skills',
            ],
            nice_to_have: [
              'Experience selling sales tech or SaaS',
              'Familiarity with Outreach, Salesloft, or similar',
            ],
            location: 'Seattle, WA or Remote',
            salary: '$58,000–$68,000 base + commission',
          },
        },
        stage: 'Final Round',
        format: 'Virtual',
        scheduled_at: _scheduledAt(-5, 11),
        status: 'completed',
        coach_score: 78,
        created_at: _daysFromNow(-14),
        sessions: (function() {
          var base = Date.now() - 5 * 86400000;
          return [{
            session_id: _uuid(),
            created_at: _daysFromNow(-5),
            transcript: [
              { speaker: 'you', text: "I've been an SDR for about eighteen months, focused on mid-market outbound at a SaaS company. I manage roughly three hundred accounts and run multi-channel sequences across phone, email, and LinkedIn. Last quarter I came in at a hundred and twelve percent of my meeting quota, which I'm proud of given Q3 is historically our slowest.", timestamp: base },
              { speaker: 'you', text: "My prospecting process starts the night before. I'll pick five to ten accounts, look for a specific trigger — a funding announcement, a new hire, a job posting that signals a pain point — and write a first email from scratch based on that. Follow-ups are semi-templated but always reference something from the prior touch. I don't do fully automated sequences for tier-one accounts.", timestamp: base + 240000 },
              { speaker: 'you', text: "The objection I've gotten best at handling is 'we already have something for that.' I used to push back on it. Now I treat it as a question — I'll say 'totally fair, what made you choose it?' and that almost always opens a real conversation about whether it's actually working. Most people don't love the tool they're using, they just haven't had a reason to look.", timestamp: base + 540000 },
              { speaker: 'you', text: "I actually use Outreach at my current company, which I think is a real advantage here. I'm not learning the platform, I'm selling something I use every day. The pitch I'd lead with centers on the analytics layer — being able to see what's resonating and iterate quickly. That feedback loop is what makes it different from a basic sequencer.", timestamp: base + 840000 },
              { speaker: 'you', text: "I missed target in January. It was my first month with an expanded territory and I tried to work all three hundred accounts instead of tiering aggressively. I was spread too thin and my quality dropped. I went back to basics — built a tight tier-one list of forty accounts, got focused, and recovered to a hundred and six percent by March. I learned more from that miss than from any month I hit quota.", timestamp: base + 1200000 },
              { speaker: 'you', text: "What gets me into this work is the craft side. I spend time reading about messaging, listening to my own call recordings, testing subject lines. I find it genuinely interesting, not just something I have to do. And Outreach's product is built for people who think that way — the premise is that if you pay attention to the data, you can get better faster. That's the environment I want to be in.", timestamp: base + 1500000 },
              { speaker: 'you', text: "It comes down to three things. Product belief — I use Outreach and I think it's the best tool in its category. The internal culture around data and iteration, which I've heard about from people on your team. And the AE path — I want to make that transition in twelve to eighteen months and I've heard Outreach is one of the better places for it.", timestamp: base + 1800000 },
              { speaker: 'you', text: "My main question is around what separates the SDRs who transition to AE quickly from those who stay in role longer than expected. Not just that the path exists — I want to understand what the top performers actually do differently in their first year that makes the difference.", timestamp: base + 2100000 },
            ],
            feedback: '**Answer Quality**\nAnswers were consistently structured and grounded in specifics — the 112% quota figure, the January miss with a clear recovery arc, and genuine product knowledge all added real credibility. The objection-handling answer was the standout: it moved cleanly from old behavior to new insight to outcome. The "why Outreach" answer showed authentic product familiarity rather than rehearsed talking points, which is rare at the final-round stage.\n\n**Delivery**\nPacing was confident throughout with minimal filler — a couple of instances of "um" and "I think" but nothing distracting. The failure story came across as well-rehearsed in the right sense: clear, self-aware, no over-hedging. Slight uptick in pace when walking through the prospecting process — worth watching on calls where you want the listener to absorb the detail.\n\n**Answer Length**\nMost answers ran 45–75 seconds, which is the right range for a final round. The objection-handling and failure answers hit the ideal length: specific enough to be credible, concise enough to hold attention. The closing "why Outreach" answer could have used one more concrete example — it ended a beat early and slightly undersold the conviction.\n\n**Clarity & Confidence**\nHigh confidence on metrics, product knowledge, and the failure story. The motivation answer was the clearest of the session — direct and specific with no hedging. The closing question for the interviewer was good but ended as a statement rather than a real exchange; a follow-on check-in would have kept you in control of the close.\n\n**Top Improvements**\n• Quantify the "why Outreach" answer — you described the analytics layer well but never tied it to a personal result. Add one data point: a subject line test, a sequence that outperformed, anything measurable that shows you\'ve already done the thing you\'re selling.\n• Turn your close into a dialogue — after expressing enthusiasm, add a micro-ask: "Is there anything from our conversations today that would give you pause?" That shifts from monologue to closing move.\n• Lead the failure answer with the outcome first ("I missed January by about 20%"), then explain why. You got there, but the inverted structure would have landed with more confidence from the start.',
          }];
        })(),
        coach_analysis: `SCORE: 78
**What You Did Well**
• Opened with a strong research hook referencing Outreach's recent Series D — showed genuine preparation
• Handled the "we already have a tool for that" objection confidently with a pivot to ROI
• Closed clearly by proposing a specific next step rather than leaving it open

**What to Improve**
• Over-explained the product feature set early — lead with pain, not features
• Used filler phrases ("to be honest", "at the end of the day") repeatedly — record yourself and eliminate them
• When asked about failure, pivoted away too quickly — interviewers want to see self-awareness, lean into it

**For Your Next Interview**
• Prepare a tight 30-second "why SDR, why this company" answer and practice it until it feels natural
• Have two quantified stories ready: one pipeline win, one objection you turned around
• Ask at least one question that shows you've researched the team specifically, not just the company`,
      },
      {
        id: IV_GONG,
        process_id: AP_GONG,
        company: GONG,
        interviewers: [
          { name: 'Sarah Okonkwo', title: 'Sales Recruiter', linkedin_url: '' },
          { name: 'Derek Walsh', title: 'SDR Manager', linkedin_url: '' },
          { name: 'Tina Reyes', title: 'Senior SDR', linkedin_url: '' },
        ],
        jd: {
          raw: 'Gong is looking for SDRs who are obsessed with the craft of sales...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Drive outbound pipeline for Gong\'s Enterprise segment',
              'Use Gong\'s own platform to analyse and improve your outreach',
              'Collaborate with Enterprise AEs on named account strategy',
              'Consistently hit and exceed KPIs for calls, emails, and meetings set',
            ],
            must_have: [
              '6+ months of SDR or sales experience',
              'Metrics-driven mindset',
              'Excellent phone presence',
            ],
            nice_to_have: [
              'Experience using conversation intelligence tools',
              'Enterprise prospecting experience',
            ],
            location: 'San Francisco, CA (Hybrid)',
            salary: '$60,000–$70,000 base + OTE $100,000',
          },
        },
        stage: 'Panel',
        format: 'Virtual',
        scheduled_at: _scheduledAt(-14, 13),
        status: 'completed',
        coach_score: 84,
        created_at: _daysFromNow(-21),
        coach_analysis: `SCORE: 84
**What You Did Well**
• Demonstrated solid product knowledge across all three interviewers without being repetitive
• Gave concrete numbers when asked about past performance — this stood out
• Stayed composed during the panel format, making clear eye contact with each person

**What to Improve**
• The role-play scenario caught you off guard — practice cold call openers so they feel natural under pressure
• Took too long to answer "what's your weakness" — prepare this in advance, it always comes up
• Could have asked more insightful questions; two of your three questions were answered in the JD

**For Your Next Interview**
• Always have a cold call opener ready — "Hi [name], I'll be upfront, this is a cold call — got 27 seconds?" is simple and effective
• Quantify your "greatest achievement" story: pipeline generated, conversion rate, or quota attainment
• Research panel interviewers on LinkedIn before the call and reference something specific about each person`,
      },
      // ── Extra stages (multi-round pipelines) ──────────────────────────────────
      {
        id: IV_SF_HM,
        process_id: AP_SF,
        company: SALESFORCE,
        interviewers: [],
        jd: null,
        stage: 'Hiring Manager',
        format: 'Virtual',
        scheduled_at: null,
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-7),
      },
      {
        id: IV_HB_RS,
        process_id: AP_HB,
        company: HUBSPOT,
        interviewers: [{ name: 'Priya Nair', title: 'Talent Acquisition', linkedin_url: '' }],
        jd: null,
        stage: 'Recruiter Screen',
        format: 'Phone Screen',
        scheduled_at: _scheduledAt(-7, 11),
        status: 'completed',
        created_at: _daysFromNow(-21),
      },
      {
        id: IV_OUT_RS,
        process_id: AP_OUT,
        company: OUTREACH,
        interviewers: [{ name: 'Kira Santos', title: 'Talent Recruiter', linkedin_url: '' }],
        jd: null,
        stage: 'Recruiter Screen',
        format: 'Phone Screen',
        scheduled_at: _scheduledAt(-18, 10),
        status: 'completed',
        created_at: _daysFromNow(-28),
      },
      {
        id: IV_OUT_HM,
        process_id: AP_OUT,
        company: OUTREACH,
        interviewers: [{ name: 'Marcus Reid', title: 'Hiring Manager', linkedin_url: '' }],
        jd: null,
        stage: 'Hiring Manager',
        format: 'Virtual',
        scheduled_at: _scheduledAt(-11, 14),
        status: 'completed',
        created_at: _daysFromNow(-20),
      },
      {
        id: IV_GONG_RS,
        process_id: AP_GONG,
        company: GONG,
        interviewers: [{ name: 'Sarah Okonkwo', title: 'Sales Recruiter', linkedin_url: '' }],
        jd: null,
        stage: 'Recruiter Screen',
        format: 'Phone Screen',
        scheduled_at: _scheduledAt(-21, 10),
        status: 'completed',
        created_at: _daysFromNow(-28),
      },
    ];

    // ── Processes (Interviews tab parent rows) ─────────────────────────────────
    const processes = [
      {
        id: AP_SF,
        company_name: SALESFORCE.name,
        company_logo: SALESFORCE.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Active',
        notes: null,
        created_at: _daysFromNow(-14),
        updated_at: _daysFromNow(-7),
      },
      {
        id: AP_HB,
        company_name: HUBSPOT.name,
        company_logo: HUBSPOT.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Active',
        notes: null,
        created_at: _daysFromNow(-21),
        updated_at: _daysFromNow(-3),
      },
      {
        id: AP_OUT,
        company_name: OUTREACH.name,
        company_logo: OUTREACH.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Offer Received',
        notes: null,
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-5),
      },
      {
        id: AP_GONG,
        company_name: GONG.name,
        company_logo: GONG.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Rejected',
        notes: null,
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-14),
      },
    ];

    // ── Applications ───────────────────────────────────────────────────────────
    const applications = [
      {
        id: AP_SF,
        company: SALESFORCE,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-14),
        date_first_interview: _dateStr(1),
        status: 'Interviewing',
        current_stage: 'Recruiter Screen',
        jd: null,
        notes: '',
        interview_ids: [IV_SF],
        created_at: _daysFromNow(-14),
        updated_at: _daysFromNow(-14),
      },
      {
        id: AP_HB,
        company: HUBSPOT,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-21),
        date_first_interview: _dateStr(3),
        status: 'Interviewing',
        current_stage: 'Hiring Manager',
        jd: null,
        notes: '',
        interview_ids: [IV_HB],
        created_at: _daysFromNow(-21),
        updated_at: _daysFromNow(-21),
      },
      {
        id: AP_OUT,
        company: OUTREACH,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-28),
        date_first_interview: _dateStr(-5),
        status: 'Interviewing',
        current_stage: 'Final Round',
        jd: null,
        notes: '',
        interview_ids: [IV_OUT],
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-5),
      },
      {
        id: AP_GONG,
        company: GONG,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-28),
        date_first_interview: _dateStr(-14),
        status: 'Rejected',
        current_stage: 'Panel',
        jd: null,
        notes: '',
        interview_ids: [IV_GONG],
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-14),
      },
    ];

    // ── Resume ─────────────────────────────────────────────────────────────────
    const resume = {
      raw_text: `ALEX MORGAN
alex.morgan@email.com | (415) 555-0192 | LinkedIn: linkedin.com/in/alexmorgan | San Francisco, CA

SUMMARY
Results-driven Sales Development Representative with 18 months of experience in B2B SaaS. Track record of exceeding outbound activity targets and converting cold outreach into qualified pipeline. Comfortable with high-velocity prospecting across phone, email, and LinkedIn.

EXPERIENCE

Sales Development Representative — TechStartup Inc., San Francisco, CA
March 2023 – Present
• Responsible for making outbound calls and sending emails to prospects in the SMB segment
• Helped the team exceed quarterly targets for two consecutive quarters
• Managed a territory of 300+ named accounts across the retail vertical
• Used Salesforce CRM to log activity and track pipeline
• Collaborated with Account Executives to refine messaging and ICP

Business Development Intern — GrowthCo, Remote
June 2022 – February 2023
• Assisted with lead generation and list building for outbound campaigns
• Ran LinkedIn outreach sequences targeting director-level buyers
• Supported 3 AEs with account research and competitive analysis

EDUCATION
B.A. Communications — University of California, Santa Barbara, 2022

SKILLS
CRM: Salesforce, HubSpot | Sequencing: Outreach, Salesloft | Research: LinkedIn Sales Navigator, ZoomInfo
Cold calling, email copywriting, objection handling, territory management`,

      analysis: {
        overall_score: 68,
        dimensions: {
          impact:            62,
          clarity:           74,
          ats_compatibility: 65,
          sdr_relevance:     82,
        },
        highlights: [
          {
            id: 'h1',
            original: 'Responsible for making outbound calls and sending emails to prospects in the SMB segment',
            reason: 'Passive construction with no outcome. Replace the verb and add a metric — how many calls, what conversion rate, what did it generate?',
            rewrite: null,
          },
          {
            id: 'h2',
            original: 'Helped the team exceed quarterly targets for two consecutive quarters',
            reason: '"Helped" buries your contribution. Own it. What was the target? What did you personally contribute?',
            rewrite: null,
          },
          {
            id: 'h3',
            original: 'Managed a territory of 300+ named accounts across the retail vertical',
            reason: 'Good specificity on territory size. Add a pipeline or meeting metric to show what you did with those accounts.',
            rewrite: null,
          },
        ],
        ats_tips: [
          'Add "SDR" or "Sales Development Representative" to your title line — ATS systems scan for exact job title matches',
          'Include a quota attainment percentage (e.g. "112% of quota") — this is a top keyword for SDR roles',
          'Name your sequencing tools explicitly: Outreach and Salesloft are in your skills section but not your bullets',
          'Add a pipeline dollar amount — "$X pipeline generated" is a high-signal keyword for recruiting tools',
        ],
        summary: 'Solid SDR profile with relevant tool experience and clear vertical focus. The main gap is quantification — nearly every bullet describes activity rather than outcomes. Adding 2–3 hard numbers (meetings set, pipeline generated, quota %) would move this from a 68 to an 85+ overnight.',
      },
      role_fits: {
        [IV_OUT]: {
          keyword_match_score: 76,
          keywords_present: [
            'Outreach (platform experience)',
            'B2B SaaS outbound prospecting',
            'Multi-channel sequences (phone/email/LinkedIn)',
            'LinkedIn Sales Navigator',
            'Salesforce CRM',
          ],
          keywords_missing: [
            'Quota attainment % (not stated)',
            'Pipeline dollar amount missing',
            'Mid-market/enterprise account scope',
            'Conversation intelligence tools',
          ],
          talking_points: [
            'Lead with the 112% quota figure immediately — Outreach is metrics-driven and this is your strongest credibility signal',
            'Emphasize you\'re a current Outreach user: you\'re selling a tool you rely on every day, not one you learned for the interview',
            'Connect your tiering methodology directly to their JD language around "Mid-Market segment" and "territory strategy"',
          ],
          strategic_summary: 'Solid alignment on core SDR skills, platform familiarity, and prospecting methodology. The main gap is quantification — the JD calls for "demonstrated ability to exceed activity-based targets" but the resume describes activities rather than outcomes. Going into this Final Round, anchor every answer in a specific number: meetings set, conversion rate, or quota attainment percentage.',
        },
      },
      created_at: _daysFromNow(-10),
      updated_at: _daysFromNow(-10),
    };

    // ── Dry Run ────────────────────────────────────────────────────────────────
    const dryRun = {
      id: DR_ID,
      created_at: _daysFromNow(-2),
      mode: 'company',
      stage: 'Hiring Manager',
      interview_id: IV_HB,
      history: [
        { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve been in sales for about a year and a half now, starting as a BDR at a SaaS company. I love the prospecting side of the role — the research, the outreach, figuring out what makes someone respond. I\'m interested in HubSpot specifically because the product is one I\'ve actually used and believe in, which makes selling it feel natural.' },
        { question: 'Walk me through your typical outbound process from first touch to booked meeting.', answer: 'I start with research — 10 minutes on the company and the specific person. Then I build a sequence: personalised first email, follow-up with a different angle, LinkedIn touchpoint, call. I try to lead with a trigger event if there is one, like a funding round or a new hire. If I get someone on the phone I focus on opening fast and asking one qualifying question before pitching.' },
        { question: 'What\'s your proudest prospecting win and what made it work?', answer: 'I booked a meeting with a VP of Sales at a company that had ignored three previous reps for six months. I found out they\'d just promoted someone internally to run their SDR team. I sent a short email congratulating them and offering one specific idea for how we could help that new manager ramp faster. Got a reply in 20 minutes.' },
        { question: 'How do you handle a prospect who says "just send me some information"?', answer: 'I usually say something like — I\'d love to, and to make sure I send the most relevant thing, can I ask what\'s top of mind for you right now? If they still push, I send something short and specific, not a generic one-pager, and I follow up with a question tied to what I sent.' },
        { question: 'What does a bad prospecting day look like for you and how do you recover?', answer: 'A bad day is when I\'m going through the motions and the emails feel generic. I\'ve learned to notice that. When it happens I usually stop and do 20 minutes of deep research on one account, write one really good personalised email, and that resets my energy. Quality usually brings quantity back.' },
        { question: 'How do you prioritise your account list when you have 200 accounts to work?', answer: 'I tier them. Tier 1 is accounts that hit all my ICP criteria plus have a recent trigger — those get full personalisation. Tier 2 gets a semi-personalised sequence. Tier 3 gets a high-volume sequence. I spend most of my time on Tier 1 and check in on the others.' },
        { question: 'Tell me about a time you got feedback that was hard to hear.', answer: 'My manager told me my call openings were too long — I was over-explaining before I\'d even asked if they had a minute. It stung a bit because I thought I was being thorough. But I recorded myself and he was right. I cut my openers to under 15 seconds and my connect-to-conversation rate went up pretty quickly.' },
        { question: 'Why HubSpot over a competitor like Salesforce or another CRM company?', answer: 'Honestly, HubSpot\'s product philosophy aligns with how I think about sales. It\'s built around making it easier for buyers to engage, not just easier for sellers to track. I\'ve used it on the marketing side and the CRM side and it actually gets used, which a lot of tools don\'t. The ICP also feels like a space where I can have real conversations about real problems.' },
        { question: 'Where do you see yourself in two years?', answer: 'I want to be an Account Executive. I think the SDR role is the best possible training ground for that — you learn pipeline, you learn objection handling, you learn how buyers think. I want to make the most of the SDR year and a half, be genuinely good at it, and then make the transition.' },
        { question: 'Do you have any questions for me?', answer: 'What does the ramp look like for a new SDR — how long until someone is expected to be at full quota? And what\'s something that separates the SDRs who make it to AE from the ones who stay in the role longer than expected?' },
      ],
      report: {
        overall_score: 80,
        summary: 'Strong overall performance. You came across as confident, well-prepared, and genuinely interested in the role rather than just the job. The standout moments were your specific prospecting win story and the self-aware answer about hard feedback. Main area to tighten: a couple of answers ran slightly long — SDR interviewers are looking for concise, punchy communication.',
        question_feedback: [
          { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve been in sales for about a year and a half now...', feedback: 'Clean and confident opening. Good that you connected your interest to the product specifically — that\'s more convincing than "I love the brand." Could trim by 20 seconds.', score: 80 },
          { question: 'Walk me through your typical outbound process from first touch to booked meeting.', answer: 'I start with research...', feedback: 'Excellent structure. Trigger event mention shows sophistication. One small thing: "qualifying question before pitching" — name the question or give an example to make it concrete.', score: 90 },
          { question: 'What\'s your proudest prospecting win and what made it work?', answer: 'I booked a meeting with a VP of Sales...', feedback: 'Best answer of the session. Specific, outcome-focused, shows creative thinking. This is exactly what interviewers want to hear.', score: 98 },
          { question: 'How do you handle a prospect who says "just send me some information"?', answer: 'I usually say something like...', feedback: 'Good redirect technique. The follow-up with a specific question rather than a generic one-pager shows experience. Solid.', score: 82 },
          { question: 'What does a bad prospecting day look like for you and how do you recover?', answer: 'A bad day is when I\'m going through the motions...', feedback: 'Self-aware and practical. The "write one really good email" recovery tactic is believable and specific. Good answer.', score: 78 },
          { question: 'How do you prioritise your account list when you have 200 accounts to work?', answer: 'I tier them...', feedback: 'Tiered approach is the right answer and you explained it clearly. Could be slightly more specific about what a "trigger" looks like in practice.', score: 72 },
          { question: 'Tell me about a time you got feedback that was hard to hear.', answer: 'My manager told me my call openings were too long...', feedback: 'One of the better "feedback" answers. You didn\'t deflect, you showed the change you made, and you measured the outcome. That\'s the trifecta.', score: 91 },
          { question: 'Why HubSpot over a competitor like Salesforce or another CRM company?', answer: 'Honestly, HubSpot\'s product philosophy aligns...', feedback: 'Good differentiation angle. "Gets used" is a real point — tool adoption is a genuine pain point for buyers. Rings authentic.', score: 81 },
          { question: 'Where do you see yourself in two years?', answer: 'I want to be an Account Executive...', feedback: 'Correct answer. You expressed ambition without sounding like you\'re just using the SDR role as a stepping stone. Balance struck well.', score: 74 },
          { question: 'Do you have any questions for me?', answer: 'What does the ramp look like...', feedback: 'Both questions are smart and show you\'re thinking about success, not just getting the job. Strong close.', score: 88 },
        ],
        patterns: {
          strengths: [
            'Specific, outcome-driven storytelling — you cite real situations rather than generalities',
            'Clear prospecting methodology — you can articulate your process step by step',
            'Genuine product knowledge and belief — comes across as authentic, not rehearsed',
            'Strong self-awareness — you acknowledge weaknesses and show what you did about them',
          ],
          improvements: [
            'Trim answer length by 15–20% — conciseness signals communication skills',
            'Add more specific numbers — quota %, meetings set, pipeline generated',
            'Make your frameworks concrete — name the exact question you ask, the exact email you send',
          ],
        },
        filler_words: { count: 9, examples: ['honestly', 'kind of', 'you know'] },
        talk_time_note: 'Your answers averaged about 90 seconds each — slightly long for an SDR interview where brevity signals communication skill. Aim for 60–75 seconds on most questions and save the longer answers for "tell me about a win" type prompts.',
      },
    };

    // ── Additional Dry Runs ────────────────────────────────────────────────────
    const dryRunSF = {
      id: DR_ID_SF,
      created_at: _daysFromNow(-5),
      mode: 'company',
      stage: 'Recruiter Screen',
      interview_id: IV_SF,
      history: [
        { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve spent the last year and a half doing outbound in SaaS — mostly prospecting into the SMB and mid-market segments. What draws me to this role specifically is that I\'ve been using Salesforce CRM every day, so I\'d be selling a product I actually rely on. I think that\'s a genuinely different kind of credibility when you\'re talking to a prospect.' },
        { question: 'Are you comfortable running high-volume outbound — 80-plus touchpoints per day?', answer: 'Comfortable is almost an understatement. In my current role I\'m running around 90 to 100 touches on a normal day across phone, email, and LinkedIn. I\'ve actually built a morning block system where I batch call activity in the first two hours before email takes over. The volume only works if the structure underneath it is solid.' },
        { question: 'What CRM tools have you used and how deeply did you work in them?', answer: 'Salesforce primarily — I use it for pipeline management, activity logging, and pulling call lists. I\'ve also worked in HubSpot briefly. In Salesforce specifically I got comfortable building my own views and reports, not just using what my manager set up. I understand the difference between a lead and a contact and why it matters for territory tracking.' },
        { question: 'Walk me through how you research a prospect before your first outreach.', answer: 'I start with the company first — recent news, funding, headcount growth signals on LinkedIn. Then I go to the specific person: their role, how long they\'ve been there, what they post about. I\'m looking for one genuine hook I can lead with. If the company just hired a VP of Sales, that\'s a signal. If the person wrote about pipeline generation, I can reference that specifically.' },
        { question: 'Where do you see yourself in two years?', answer: 'I want to make the move to Account Executive. I\'m not in a rush — I think the SDR year and a half is genuinely where you build the foundation for everything else in sales. But I want to be the kind of SDR who runs enough pipeline and builds enough fluency in the sales conversation that the transition feels earned when it comes.' },
      ],
      report: {
        overall_score: 73,
        summary: 'Solid recruiter screen performance. You came across as grounded and well-prepared, with genuine product familiarity. The volume-handling and CRM answers were notably strong. Main gap: answers occasionally ran long on setup before getting to the core point — lead with your strongest sentence.',
        question_feedback: [
          { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve spent the last year and a half doing outbound in SaaS...', feedback: 'Relevant opening with a good product-credibility hook at the end. The setup ran about 15 seconds longer than it needed to — lead with the product angle first, then add context.', score: 70 },
          { question: 'Are you comfortable running high-volume outbound — 80-plus touchpoints per day?', answer: 'Comfortable is almost an understatement...', feedback: 'Best answer of the session. Specifics on 90-100 touches, a named system (morning block), and the follow-through point about structure making volume work. This is what high-confidence SDR answers sound like.', score: 88 },
          { question: 'What CRM tools have you used and how deeply did you work in them?', answer: 'Salesforce primarily...', feedback: 'The detail about building your own views and understanding leads vs. contacts is exactly the right level of specificity. Shows you\'re a practitioner, not a checkbox candidate.', score: 82 },
          { question: 'Walk me through how you research a prospect before your first outreach.', answer: 'I start with the company first...', feedback: 'Good structure (company → person → hook). The VP of Sales hire example is a real trigger signal, which shows you actually think this way. Could have named one more concrete example of a message you\'d send.', score: 74 },
          { question: 'Where do you see yourself in two years?', answer: 'I want to make the move to Account Executive...', feedback: '"Earned when it comes" is a good phrase. The answer is confident without being presumptuous. Slightly generic — a sentence about what specifically about Salesforce\'s AE path attracted you would have grounded it.', score: 65 },
        ],
        patterns: {
          strengths: [
            'Specific activity numbers — citing 90-100 daily touches makes your volume answer credible, not vague',
            'Product familiarity at a practitioner level — building your own CRM views shows you\'re a power user',
            'Clean signal-based prospecting framework — company then person then hook is structured and repeatable',
          ],
          improvements: [
            'Lead with your strongest sentence — several answers buried the headline in the middle',
            'Ground your two-year answer in something specific to this company rather than leaving it generic',
            'Add one result metric to the intro — even a rough meetings-set number would raise the opening significantly',
          ],
        },
        filler_words: { count: 6, examples: ['actually', 'specifically', 'kind of'] },
        talk_time_note: 'Answers averaged around 75 seconds — slightly above the ideal 60-second target for a recruiter screen. The extra length is coming from setup sentences before the main point. Practice leading with your conclusion and adding context after.',
      },
    };

    const dryRunGong = {
      id: DR_ID_GONG,
      created_at: _daysFromNow(-9),
      mode: 'company',
      stage: 'Final Round',
      interview_id: IV_GONG,
      history: [
        { question: 'How would you use Gong\'s own platform to improve your prospecting?', answer: 'I\'d start by pulling call recordings from the top five percent of calls in terms of conversion rate. I want to know what patterns appear in the openers and first two minutes. Then I\'d compare those against my own calls in the same time range and find the gaps. The second thing I\'d do is look at sentiment analysis data to see where prospects disengage — and use that to redesign the sequences where disengagement is highest. It\'s a continuous feedback loop that most SDRs leave on the table.' },
        { question: 'Tell me about a time you turned a cold prospect into a booked meeting against the odds.', answer: 'I had a VP of Sales who had been in our CRM for eight months with zero engagement across every rep who touched the account. I noticed she\'d just posted on LinkedIn about struggling to get her new SDR team to ramp fast. I sent a two-sentence email: "Saw your post about SDR ramp time — we\'ve helped three similar teams cut ramp from 90 days to 45. Worth a 20-minute call?" She replied in four hours. The key was specificity — I didn\'t pretend to know her problem, I referenced her own words.' },
        { question: 'Describe a failure in your sales career and what you took from it.', answer: 'Early in my current role I had a month where I hit activity targets but missed my meeting quota by 30 percent. I was focused entirely on volume — hitting the number of calls and emails — without asking whether those calls and emails were any good. My manager showed me the data: my connect rate was fine but my conversation-to-meeting rate was half the team average. That was the moment I understood the difference between activity and effectiveness. I rebuilt my call opener and my first email from scratch and recovered over the next two months.' },
        { question: 'How would you pitch Gong to a prospect who already uses a conversation intelligence tool?', answer: 'I\'d ask them what they actually use the tool for day to day. In my experience most CI users are running it for manager review and compliance — they\'re not using it to proactively train their reps. Then I\'d focus on Gong\'s coaching workflows: the ability to set up libraries of winning calls, the automated alerts when a rep misses a key topic. The pitch isn\'t "we have better features" — it\'s "you\'re using 20 percent of what your current tool can do, and here\'s what the other 80 percent looks like when a team actually uses it."' },
        { question: 'Walk us through a cold call opening you\'ve used that consistently gets traction.', answer: 'I use a version of the upfront contract open. Something like: "Hi Sarah, this is Alex — completely cold call, is this still a bad time?" The "still" implies it\'s always a bad time, which gets a laugh about 40 percent of the time. Then immediately: "I promise I\'ll be quick — I work with sales teams at companies like yours and I\'ve been seeing a pattern that I thought was worth a quick call. One minute?" If they stay on the line through that, they\'re already curious. I close with a question, not a pitch.' },
      ],
      report: {
        overall_score: 91,
        summary: 'Exceptional final round performance. Every answer was specific, structured, and showed genuine mastery of the craft. The Gong platform answer was particularly impressive — you didn\'t just describe features, you explained how you\'d extract value from data that most SDRs ignore. The cold call opening answer closed with a method, not just an example. One minor note: the failure answer was strong but slightly over-explained the recovery.',
        question_feedback: [
          { question: 'How would you use Gong\'s own platform to improve your prospecting?', answer: 'I\'d start by pulling call recordings from the top five percent...', feedback: 'Outstanding. You named specific data sources (top-5% conversion calls, sentiment analysis), specific actions (redesign sequences where disengagement is highest), and the underlying principle (continuous feedback loop). This answer would stand out in any final round.', score: 96 },
          { question: 'Tell me about a time you turned a cold prospect into a booked meeting against the odds.', answer: 'I had a VP of Sales who had been in our CRM for eight months...', feedback: 'Perfect story structure. The eight-month ghost detail sets stakes. The two-sentence email shows restraint. Closing with "I referenced her own words" shows you understand why it worked — that\'s the insight that makes it a teaching story, not just a brag.', score: 95 },
          { question: 'Describe a failure in your sales career and what you took from it.', answer: 'Early in my current role I had a month where I hit activity targets but missed my meeting quota by 30 percent...', feedback: 'The activity-versus-effectiveness insight is genuinely good and specific. The data your manager showed you (connect rate fine, conversation-to-meeting rate was half the team) shows self-awareness without defensiveness. The recovery arc is slightly over-explained — you can cut two sentences after the "rebuilt from scratch" line.', score: 88 },
          { question: 'How would you pitch Gong to a prospect who already uses a conversation intelligence tool?', answer: 'I\'d ask them what they actually use the tool for day to day...', feedback: '"You\'re using 20 percent of what your current tool can do" is a genuinely effective reframe. The setup of asking how they use it before pitching shows sales maturity. Could have named one specific Gong feature by name to ground the pitch more concretely.', score: 89 },
          { question: 'Walk us through a cold call opening you\'ve used that consistently gets traction.', answer: 'I use a version of the upfront contract open...', feedback: 'The "still a bad time" framing is memorable and the 40% laugh rate is a credible detail. Ending with "I close with a question, not a pitch" shows you understand the principle, not just the script. Strong close to the session.', score: 93 },
        ],
        patterns: {
          strengths: [
            'Data-driven thinking — you instinctively reference metrics to support every claim',
            'Principle-based answers — you explain why your approaches work, not just what you do',
            'Platform fluency — your Gong answer showed genuine understanding of how to extract value from CI data',
            'Story structure — your prospecting win had clear stakes, specific action, and a replicable insight',
          ],
          improvements: [
            'Trim the recovery arc in failure stories — once you show the fix worked, stop',
            'Name specific features or data types when pitching a product — "coaching workflows" could become "Deal Warnings and Call Spotlight"',
            'The competitive pitch could benefit from one quantified customer story to ground the 20% claim',
          ],
        },
        filler_words: { count: 3, examples: ['kind of', 'actually'] },
        talk_time_note: 'Answer length was well-controlled throughout — most responses hit the 75–90 second range appropriate for a final round. The failure story ran slightly long at ~2 minutes; trim the recovery section to keep it under 90 seconds.',
      },
    };

    // ── Community Questions (dev fallback — normally lives in Supabase) ────────
    const communityQuestions = {
      'salesforce.com': [
        { question: 'Tell me about yourself and what draws you to an SDR role.', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-45) },
        { question: 'What do you know about Salesforce and why do you want to work here specifically?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-38) },
        { question: 'Are you comfortable with high-volume outbound — 80-plus touchpoints per day?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-30) },
        { question: 'What CRM tools have you used and how deeply did you work inside them?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-22) },
        { question: 'Walk me through your background and how it prepares you for this role.', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-14) },
        { question: 'Where do you see yourself in two years?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-7) },
      ],
      'hubspot.com': [
        { question: 'Walk me through your outbound prospecting process from first touch to booked meeting.', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-60) },
        { question: 'How do you handle a prospect who says they\'re not interested?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-52) },
        { question: 'Tell me about a time you exceeded your activity or quota targets.', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-44) },
        { question: 'How do you prioritize your account list when you have hundreds of accounts to work?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-36) },
        { question: 'What\'s your approach to cold email copywriting — what makes a good subject line?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-28) },
        { question: 'How do you stay motivated during a tough prospecting week?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-20) },
        { question: 'How do you research a prospect before reaching out?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-12) },
      ],
      'outreach.io': [
        { question: 'How do you use data and analytics to iterate on your outreach sequences?', interview_stage: 'Final Round', created_at: _daysFromNow(-90) },
        { question: 'Give me an example of a creative prospecting approach that got a reply when nothing else had.', interview_stage: 'Final Round', created_at: _daysFromNow(-75) },
        { question: 'How do you handle the "send me some information" brush-off on a cold call?', interview_stage: 'Final Round', created_at: _daysFromNow(-60) },
        { question: 'What does your ideal prospecting day look like hour by hour?', interview_stage: 'Final Round', created_at: _daysFromNow(-50) },
        { question: 'Why Outreach over other sales tech companies?', interview_stage: 'Final Round', created_at: _daysFromNow(-40) },
        { question: 'Tell me about a time you missed your target and how you got back on track.', interview_stage: 'Final Round', created_at: _daysFromNow(-30) },
        { question: 'Where do you see yourself in 18 months and how does this role get you there?', interview_stage: 'Final Round', created_at: _daysFromNow(-18) },
      ],
      'gong.io': [
        { question: 'How would you use Gong\'s own platform to improve your prospecting?', interview_stage: 'Panel', created_at: _daysFromNow(-120) },
        { question: 'Tell me about a time you turned a cold prospect into a booked meeting against the odds.', interview_stage: 'Panel', created_at: _daysFromNow(-105) },
        { question: 'Describe a failure in your sales career and what you took from it.', interview_stage: 'Panel', created_at: _daysFromNow(-90) },
        { question: 'How do you research enterprise accounts before building a sequence?', interview_stage: 'Panel', created_at: _daysFromNow(-75) },
        { question: 'How would you pitch Gong to a prospect who already uses a conversation intelligence tool?', interview_stage: 'Panel', created_at: _daysFromNow(-60) },
        { question: 'Walk us through a cold call opening you\'ve used that consistently gets traction.', interview_stage: 'Panel', created_at: _daysFromNow(-45) },
        { question: 'What metrics do you use to judge whether your outreach is working?', interview_stage: 'Panel', created_at: _daysFromNow(-30) },
      ],
    };

    // ── Settings ───────────────────────────────────────────────────────────────
    const settings = { notifications_enabled: true };

    const profile = {
      completed: true,
      role_type: 'AE', experience_years: '3–5 years',
      company_size: ['Scale-up (51–500)', 'Mid-market (501–2000)'],
      challenge: ['Structuring my answers', 'Nerves & confidence'],
      job_search_status: 'Actively interviewing',
      strongest_asset: 'Consistent quota attainment',
      improvement_area: 'Compensation negotiation',
      tools: 'Salesforce, Outreach, Gong',
      salary_range: 'USD $120,000 – $150,000',
      additional_context: '[seed data]',
    };

    // ── Write to localStorage ──────────────────────────────────────────────────
    localStorage.setItem('klinch_setup_complete',           '1');
    localStorage.setItem('klinch_profile',                  JSON.stringify(profile));
    localStorage.setItem('klinch_interviews',               JSON.stringify(interviews));
    localStorage.setItem('klinch_processes',                JSON.stringify(processes));
    localStorage.setItem('klinch_applications',             JSON.stringify(applications));
    localStorage.setItem('klinch_resume',                   JSON.stringify(resume));
    localStorage.setItem('klinch_dry_runs',                 JSON.stringify([dryRun, dryRunSF, dryRunGong]));
    localStorage.setItem('klinch_settings',                 JSON.stringify(settings));
    localStorage.setItem('klinch_dev_community_questions',  JSON.stringify(communityQuestions));
  }

  // ── Screenshot preset ─────────────────────────────────────────────────────────
  // Fictional companies — logo.dev will 404 and brand_color drives the fallback avatar.

  function _loadScreenshot() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('klinch') && k !== 'klinch_dev_auth_bypass')
      .forEach(k => localStorage.removeItem(k));

    // ── IDs ──────────────────────────────────────────────────────────────────────
    const IV_VN     = _uuid();
    const IV_VN_HM  = _uuid();
    const IV_NX     = _uuid();
    const IV_NX_RS  = _uuid();
    const IV_MD     = _uuid();
    const IV_MD_RS  = _uuid();
    const IV_MD_HM  = _uuid();
    const IV_CL     = _uuid();
    const IV_CL_RS  = _uuid();
    const AP_VN  = _uuid();
    const AP_NX  = _uuid();
    const AP_MD  = _uuid();
    const AP_CL  = _uuid();
    const DR_NX  = _uuid();
    const DR_VN  = _uuid();
    const DR_CL  = _uuid();

    // ── Company objects ───────────────────────────────────────────────────────────
    const _logoKey = window.klinch?.logoDevKey || '';
    const _logo = (domain) => `https://img.logo.dev/${domain}?token=${_logoKey}`;

    const VANTAGE = {
      name: 'Vantage',
      domain: 'vantage.io',
      primary_domain: 'vantage.io',
      logo_url: null,
      brand_color: '#7C3AED',
      screenshot_mode: true,
    };
    const NEXUS = {
      name: 'Nexus',
      domain: 'nexus.ai',
      primary_domain: 'nexus.ai',
      logo_url: null,
      brand_color: '#0D9488',
      screenshot_mode: true,
    };
    const MERIDIAN = {
      name: 'Meridian',
      domain: 'meridian.io',
      primary_domain: 'meridian.io',
      logo_url: null,
      brand_color: '#6C5CE7',
      screenshot_mode: true,
    };
    const CRESTLINE = {
      name: 'Crestline',
      domain: 'crestline.com',
      primary_domain: 'crestline.com',
      logo_url: null,
      brand_color: '#2563EB',
      screenshot_mode: true,
    };

    // ── Interviews ────────────────────────────────────────────────────────────────
    const interviews = [
      {
        id: IV_VN,
        process_id: AP_VN,
        company: VANTAGE,
        interviewers: [{ name: 'Laura Chen', title: 'Senior Recruiter', linkedin_url: '' }],
        jd: {
          raw: 'Vantage is hiring SDRs to join our Commercial Sales team...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Generate pipeline through outbound prospecting via calls, emails, and LinkedIn',
              'Qualify inbound leads and route to Account Executives',
              'Maintain accurate data in Vantage CRM',
              'Hit monthly meeting-set quotas',
            ],
            must_have: [
              '0–2 years of sales or customer-facing experience',
              'Excellent written and verbal communication',
              'Comfortable with high-volume outreach (80+ touchpoints/day)',
              'CRM familiarity',
            ],
            nice_to_have: [
              'Experience with sales engagement platforms',
              'Prior SaaS sales exposure',
            ],
            location: 'San Francisco, CA (Hybrid)',
            salary: '$55,000–$65,000 base + commission',
          },
        },
        stage: 'Recruiter Screen',
        format: 'Virtual',
        scheduled_at: _scheduledAt(1, 10),
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-14),
      },
      {
        id: IV_NX,
        process_id: AP_NX,
        company: NEXUS,
        interviewers: [
          { name: 'David Park', title: 'SDR Manager', linkedin_url: '' },
          { name: 'Aisha Williams', title: 'Account Executive', linkedin_url: '' },
        ],
        jd: {
          raw: 'Nexus is looking for driven SDRs to join our revenue intelligence team...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Convert marketing-qualified leads into qualified sales opportunities',
              'Run targeted outbound sequences for key verticals',
              'Collaborate closely with AEs on account strategy',
              'Exceed monthly SQL targets',
            ],
            must_have: [
              'Passion for technology and sales',
              'Strong written communication and email copywriting skills',
              'Resilient and coachable attitude',
              'Experience or familiarity with CRM tools',
            ],
            nice_to_have: [
              'Nexus platform knowledge',
              'Experience in a startup or scale-up environment',
            ],
            location: 'Remote (US)',
            salary: '$50,000–$60,000 base + OTE $80,000',
          },
        },
        stage: 'Hiring Manager',
        format: 'Virtual',
        scheduled_at: _scheduledAt(3, 14),
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-21),
      },
      {
        id: IV_MD,
        process_id: AP_MD,
        company: MERIDIAN,
        interviewers: [{ name: 'Patrick Dunn', title: 'VP of Sales', linkedin_url: '' }],
        jd: null,
        stage: 'VP Sales Final Round',
        format: 'Virtual',
        scheduled_at: _scheduledAt(5, 10),
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-5),
      },
      {
        id: IV_CL,
        process_id: AP_CL,
        company: CRESTLINE,
        interviewers: [
          { name: 'James Wu', title: 'Sales Recruiter', linkedin_url: '' },
          { name: 'Nicole Osei', title: 'SDR Manager', linkedin_url: '' },
          { name: 'Tyler Brooks', title: 'Senior SDR', linkedin_url: '' },
        ],
        jd: {
          raw: 'Crestline is looking for SDRs who are obsessed with the craft of sales...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              "Drive outbound pipeline for Crestline's Enterprise segment",
              'Use Crestline\'s platform to analyse and improve your outreach',
              'Collaborate with Enterprise AEs on named account strategy',
              'Consistently hit and exceed KPIs for calls, emails, and meetings set',
            ],
            must_have: [
              '6+ months of SDR or sales experience',
              'Metrics-driven mindset',
              'Excellent phone presence',
            ],
            nice_to_have: [
              'Experience using GTM intelligence tools',
              'Enterprise prospecting experience',
            ],
            location: 'New York, NY (Hybrid)',
            salary: '$60,000–$70,000 base + OTE $100,000',
          },
        },
        stage: 'Panel',
        format: 'Virtual',
        scheduled_at: _scheduledAt(-14, 13),
        status: 'completed',
        coach_score: 84,
        created_at: _daysFromNow(-21),
        coach_analysis: `SCORE: 84
**What You Did Well**
• Demonstrated solid product knowledge across all three interviewers without being repetitive
• Gave concrete numbers when asked about past performance — this stood out
• Stayed composed during the panel format, making clear eye contact with each person

**What to Improve**
• The role-play scenario caught you off guard — practice cold call openers so they feel natural under pressure
• Took too long to answer "what's your weakness" — prepare this in advance, it always comes up
• Could have asked more insightful questions; two of your three questions were answered in the JD

**For Your Next Interview**
• Always have a cold call opener ready — "Hi [name], I'll be upfront, this is a cold call — got 27 seconds?" is simple and effective
• Quantify your "greatest achievement" story: pipeline generated, conversion rate, or quota attainment
• Research panel interviewers on LinkedIn before the call and reference something specific about each person`,
      },
      // ── Extra stages (multi-round pipelines) ──────────────────────────────────
      {
        id: IV_VN_HM,
        process_id: AP_VN,
        company: VANTAGE,
        interviewers: [],
        jd: null,
        stage: 'Hiring Manager',
        format: 'Virtual',
        scheduled_at: null,
        status: 'pending',
        nudge_sent: false,
        created_at: _daysFromNow(-7),
      },
      {
        id: IV_NX_RS,
        process_id: AP_NX,
        company: NEXUS,
        interviewers: [{ name: 'Aisha Williams', title: 'Talent Acquisition', linkedin_url: '' }],
        jd: null,
        stage: 'Recruiter Screen',
        format: 'Phone Screen',
        scheduled_at: _scheduledAt(-7, 11),
        status: 'completed',
        created_at: _daysFromNow(-21),
      },
      {
        id: IV_MD_RS,
        process_id: AP_MD,
        company: MERIDIAN,
        interviewers: [{ name: 'Chloe Huang', title: 'Talent Recruiter', linkedin_url: '' }],
        jd: {
          raw: 'Meridian is hiring SDRs to join our mid-market outbound sales team...',
          structured: {
            role_title: 'Sales Development Representative',
            responsibilities: [
              'Own outbound pipeline generation for mid-market accounts',
              'Run multi-channel sequences via phone, email, and LinkedIn',
              'Qualify inbound leads and route to Account Executives',
              'Maintain CRM hygiene and hit monthly meeting quotas',
            ],
            must_have: [
              '1+ year of B2B sales or SDR experience',
              'Comfortable with high-volume outreach',
              'Strong written and verbal communication',
            ],
            nice_to_have: [
              'Experience with sales engagement platforms',
              'SaaS industry background',
            ],
            location: 'Remote (US)',
            salary: '$52,000–$62,000 base + commission',
          },
        },
        stage: 'Recruiter Screen',
        format: 'Phone Screen',
        scheduled_at: _scheduledAt(-18, 10),
        status: 'completed',
        coach_score: 62,
        created_at: _daysFromNow(-28),
        coach_analysis: `SCORE: 62
**What You Did Well**
• Opened with a clear background summary and connected your experience to the role without rambling
• Showed real process awareness in the tiering answer — company first, person second, trigger third is the right framework

**What to Improve**
• Every performance claim was vague — "hit quota most months" without a number does nothing for your credibility
• Filler words ("like," "basically," "you know") appeared in nearly every answer and concentrated worst in the "why Meridian" response
• The "why Meridian" answer described the category, not the company — you could have given that answer about any sales tool

**For Your Next Interview**
• Anchor your opening with one hard number: quota attainment %, meetings set per week, or pipeline generated last quarter
• Rewrite your "why this company" answer with a specific detail about Meridian's product or market position
• Record a mock answer and count your filler words — awareness alone usually cuts them by half`,
        sessions: (function() {
          var base = Date.now() - 18 * 86400000;
          return [{
            session_id: _uuid(),
            created_at: _daysFromNow(-18),
            transcript: [
              { speaker: 'you', text: "I've been an SDR for about fourteen months, doing mostly outbound for a B2B SaaS company. I manage around two hundred and fifty accounts across phone, email, and LinkedIn. I've been pretty consistent — like, I've hit quota most months, which I think shows I can handle the volume.", timestamp: base },
              { speaker: 'you', text: "My process is basically to tier my accounts first. Tier one gets full personalization — I'll research the company, find a trigger, write a custom first line. The other tiers get more templated sequences. It helps me focus on the accounts that are most likely to convert.", timestamp: base + 180000 },
              { speaker: 'you', text: "When someone says they're not interested, I try not to just accept it. I'll ask something like, 'is it timing or just not a priority right now?' — that helps me figure out if it's worth staying in the sequence or pulling them out.", timestamp: base + 420000 },
              { speaker: 'you', text: "I'm interested in Meridian because, you know, it seems like a really solid company in the sales tech space and I think the product is genuinely useful. I've heard good things about the culture too.", timestamp: base + 660000 },
              { speaker: 'you', text: "In two years I want to be an Account Executive. I think doing the SDR role the right way — actually learning the process, not just hitting activity numbers — is the best foundation for that transition.", timestamp: base + 900000 },
            ],
            feedback: '**Answer Quality**\nYour background answer covered the basics but leaned on vague language — "pretty consistent" and "most months" are hedges that dilute the credibility you\'re trying to build. The tiering answer showed real process awareness but needed one more sentence to explain what outcomes that discipline drives.\n\n**Delivery**\nFiller words ("like," "basically," "you know") appeared in nearly every answer and were most pronounced in the "why Meridian" response. The objection-handling answer was cleaner — that\'s the register to aim for across the board.\n\n**Answer Length**\nLength was appropriate for a recruiter screen, but several answers ended before making a clear point. The tiering answer in particular needed 15 more seconds to land properly.\n\n**Clarity & Confidence**\nYou sounded comfortable but not compelling. Confidence comes through specifics — the absence of any quota figure or meetings-set count left most answers feeling unanchored.\n\n**Top Improvements**\n• Add one hard number to your opening — quota attainment % or meetings set per week changes the first impression immediately.\n• Rewrite your "why Meridian" answer with something specific about the company, not the category.\n• Do one recorded mock before your next screen and count your filler words — the number will surprise you.',
          }];
        })(),
      },
      {
        id: IV_MD_HM,
        process_id: AP_MD,
        company: MERIDIAN,
        interviewers: [{ name: 'Raj Patel', title: 'SDR Manager', linkedin_url: '' }],
        jd: null,
        stage: 'Hiring Manager',
        format: 'Virtual',
        scheduled_at: _scheduledAt(-11, 14),
        status: 'completed',
        coach_score: 74,
        created_at: _daysFromNow(-20),
        coach_analysis: `SCORE: 74
**What You Did Well**
• Came in with noticeably fewer filler words than the recruiter screen — the preparation showed
• The prospecting process answer was specific and structured, with a clear before/after on tiering methodology
• Closed with a strong question about what separates top performers — interviewers remember good closing questions

**What to Improve**
• The failure story pivoted to the recovery too quickly — spend more time on what went wrong before showing the fix
• "I'm a fast learner" appeared twice without any evidence; replace it with one specific example of something you learned and applied fast
• Answer length crept up on longer questions; aim to finish by 75 seconds

**For Your Next Interview**
• For the VP round, have a tight 45-second version of your prospecting process ready — senior leaders want the headline, not every step
• Have one concrete metric ready for every story: meetings set, reply rate, pipeline influenced, anything measurable
• Prepare two questions that show you've researched Meridian's market position, not just the role`,
      },
      {
        id: IV_CL_RS,
        process_id: AP_CL,
        company: CRESTLINE,
        interviewers: [{ name: 'James Wu', title: 'Sales Recruiter', linkedin_url: '' }],
        jd: null,
        stage: 'Recruiter Screen',
        format: 'Phone Screen',
        scheduled_at: _scheduledAt(-21, 10),
        status: 'completed',
        created_at: _daysFromNow(-28),
      },
    ];

    // ── Processes (Interviews tab parent rows) ─────────────────────────────────
    const processes = [
      {
        id: AP_VN,
        company_name: VANTAGE.name,
        company_logo: VANTAGE.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Active',
        notes: null,
        created_at: _daysFromNow(-14),
        updated_at: _daysFromNow(-7),
      },
      {
        id: AP_NX,
        company_name: NEXUS.name,
        company_logo: NEXUS.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Active',
        notes: null,
        created_at: _daysFromNow(-21),
        updated_at: _daysFromNow(-3),
      },
      {
        id: AP_MD,
        company_name: MERIDIAN.name,
        company_logo: MERIDIAN.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Active',
        notes: null,
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-5),
      },
      {
        id: AP_CL,
        company_name: CRESTLINE.name,
        company_logo: CRESTLINE.logo_url,
        role_title: 'Sales Development Representative',
        status: 'Rejected',
        notes: null,
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-14),
      },
    ];

    // ── Applications ──────────────────────────────────────────────────────────────
    const applications = [
      {
        id: AP_VN,
        company: VANTAGE,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-14),
        date_first_interview: _dateStr(1),
        status: 'Interviewing',
        current_stage: 'Recruiter Screen',
        jd: null,
        notes: '',
        interview_ids: [IV_VN],
        created_at: _daysFromNow(-14),
        updated_at: _daysFromNow(-14),
      },
      {
        id: AP_NX,
        company: NEXUS,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-21),
        date_first_interview: _dateStr(3),
        status: 'Interviewing',
        current_stage: 'Hiring Manager',
        jd: null,
        notes: '',
        interview_ids: [IV_NX],
        created_at: _daysFromNow(-21),
        updated_at: _daysFromNow(-21),
      },
      {
        id: AP_MD,
        company: MERIDIAN,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-28),
        date_first_interview: _dateStr(-18),
        status: 'Interviewing',
        current_stage: 'VP Sales Final Round',
        jd: null,
        notes: '',
        interview_ids: [IV_MD_RS, IV_MD_HM, IV_MD],
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-5),
      },
      {
        id: AP_CL,
        company: CRESTLINE,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-28),
        date_first_interview: _dateStr(-14),
        status: 'Rejected',
        current_stage: 'Panel',
        jd: null,
        notes: '',
        interview_ids: [IV_CL],
        created_at: _daysFromNow(-28),
        updated_at: _daysFromNow(-14),
      },
    ];

    // ── Resume ────────────────────────────────────────────────────────────────────
    const resume = {
      raw_text: `ALEX MORGAN
alex.morgan@email.com | (415) 555-0192 | LinkedIn: linkedin.com/in/alexmorgan | San Francisco, CA

SUMMARY
Results-driven Sales Development Representative with 18 months of experience in B2B SaaS. Track record of exceeding outbound activity targets and converting cold outreach into qualified pipeline. Comfortable with high-velocity prospecting across phone, email, and LinkedIn.

EXPERIENCE

Sales Development Representative — TechStartup Inc., San Francisco, CA
March 2023 – Present
• Responsible for making outbound calls and sending emails to prospects in the SMB segment
• Helped the team exceed quarterly targets for two consecutive quarters
• Managed a territory of 300+ named accounts across the retail vertical
• Used Salesforce CRM to log activity and track pipeline
• Collaborated with Account Executives to refine messaging and ICP

Business Development Intern — GrowthCo, Remote
June 2022 – February 2023
• Assisted with lead generation and list building for outbound campaigns
• Ran LinkedIn outreach sequences targeting director-level buyers
• Supported 3 AEs with account research and competitive analysis

EDUCATION
B.A. Communications — University of California, Santa Barbara, 2022

SKILLS
CRM: Salesforce, HubSpot | Sequencing: Meridian, Outreach, Salesloft | Research: LinkedIn Sales Navigator, ZoomInfo
Cold calling, email copywriting, objection handling, territory management`,

      analysis: {
        overall_score: 68,
        dimensions: {
          impact:            62,
          clarity:           74,
          ats_compatibility: 65,
          sdr_relevance:     82,
        },
        highlights: [
          {
            id: 'h1',
            original: 'Responsible for making outbound calls and sending emails to prospects in the SMB segment',
            reason: 'Passive construction with no outcome. Replace the verb and add a metric — how many calls, what conversion rate, what did it generate?',
            rewrite: null,
          },
          {
            id: 'h2',
            original: 'Helped the team exceed quarterly targets for two consecutive quarters',
            reason: '"Helped" buries your contribution. Own it. What was the target? What did you personally contribute?',
            rewrite: null,
          },
          {
            id: 'h3',
            original: 'Managed a territory of 300+ named accounts across the retail vertical',
            reason: 'Good specificity on territory size. Add a pipeline or meeting metric to show what you did with those accounts.',
            rewrite: null,
          },
        ],
        ats_tips: [
          'Add "SDR" or "Sales Development Representative" to your title line — ATS systems scan for exact job title matches',
          'Include a quota attainment percentage (e.g. "112% of quota") — this is a top keyword for SDR roles',
          'Name your sequencing tools explicitly: Meridian is in your skills section but not your bullets',
          'Add a pipeline dollar amount — "$X pipeline generated" is a high-signal keyword for recruiting tools',
        ],
        summary: 'Solid SDR profile with relevant tool experience and clear vertical focus. The main gap is quantification — nearly every bullet describes activity rather than outcomes. Adding 2–3 hard numbers (meetings set, pipeline generated, quota %) would move this from a 68 to an 85+ overnight.',
      },
      role_fits: {},
      created_at: _daysFromNow(-10),
      updated_at: _daysFromNow(-10),
    };

    // ── Dry Runs ──────────────────────────────────────────────────────────────────
    const dryRunNexus = {
      id: DR_NX,
      created_at: _daysFromNow(-2),
      mode: 'company',
      stage: 'Hiring Manager',
      interview_id: IV_NX,
      history: [
        { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve been in sales for about a year and a half now, starting as a BDR at a SaaS company. I love the prospecting side of the role — the research, the outreach, figuring out what makes someone respond. I\'m interested in Nexus specifically because the product is one I\'ve actually used and believe in, which makes selling it feel natural.' },
        { question: 'Walk me through your typical outbound process from first touch to booked meeting.', answer: 'I start with research — 10 minutes on the company and the specific person. Then I build a sequence: personalised first email, follow-up with a different angle, LinkedIn touchpoint, call. I try to lead with a trigger event if there is one, like a funding round or a new hire. If I get someone on the phone I focus on opening fast and asking one qualifying question before pitching.' },
        { question: 'What\'s your proudest prospecting win and what made it work?', answer: 'I booked a meeting with a VP of Sales at a company that had ignored three previous reps for six months. I found out they\'d just promoted someone internally to run their SDR team. I sent a short email congratulating them and offering one specific idea for how we could help that new manager ramp faster. Got a reply in 20 minutes.' },
        { question: 'How do you handle a prospect who says "just send me some information"?', answer: 'I usually say something like — I\'d love to, and to make sure I send the most relevant thing, can I ask what\'s top of mind for you right now? If they still push, I send something short and specific, not a generic one-pager, and I follow up with a question tied to what I sent.' },
        { question: 'What does a bad prospecting day look like for you and how do you recover?', answer: 'A bad day is when I\'m going through the motions and the emails feel generic. I\'ve learned to notice that. When it happens I usually stop and do 20 minutes of deep research on one account, write one really good personalised email, and that resets my energy. Quality usually brings quantity back.' },
        { question: 'How do you prioritise your account list when you have 200 accounts to work?', answer: 'I tier them. Tier 1 is accounts that hit all my ICP criteria plus have a recent trigger — those get full personalisation. Tier 2 gets a semi-personalised sequence. Tier 3 gets a high-volume sequence. I spend most of my time on Tier 1 and check in on the others.' },
        { question: 'Tell me about a time you got feedback that was hard to hear.', answer: 'My manager told me my call openings were too long — I was over-explaining before I\'d even asked if they had a minute. It stung a bit because I thought I was being thorough. But I recorded myself and he was right. I cut my openers to under 15 seconds and my connect-to-conversation rate went up pretty quickly.' },
        { question: 'Why Nexus over a competitor?', answer: 'Nexus\'s product philosophy aligns with how I think about sales. It\'s built around making it easier for buyers to engage, not just easier for sellers to track. I\'ve used it on the marketing side and the CRM side and it actually gets used, which a lot of tools don\'t. The ICP also feels like a space where I can have real conversations about real problems.' },
        { question: 'Where do you see yourself in two years?', answer: 'I want to be an Account Executive. I think the SDR role is the best possible training ground for that — you learn pipeline, you learn objection handling, you learn how buyers think. I want to make the most of the SDR year and a half, be genuinely good at it, and then make the transition.' },
        { question: 'Do you have any questions for me?', answer: 'What does the ramp look like for a new SDR — how long until someone is expected to be at full quota? And what\'s something that separates the SDRs who make it to AE from the ones who stay in the role longer than expected?' },
      ],
      report: {
        overall_score: 80,
        summary: 'Strong overall performance. You came across as confident, well-prepared, and genuinely interested in the role rather than just the job. The standout moments were your specific prospecting win story and the self-aware answer about hard feedback. Main area to tighten: a couple of answers ran slightly long — SDR interviewers are looking for concise, punchy communication.',
        question_feedback: [
          { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve been in sales for about a year and a half now...', feedback: 'Clean and confident opening. Good that you connected your interest to the product specifically — that\'s more convincing than "I love the brand." Could trim by 20 seconds.', score: 80 },
          { question: 'Walk me through your typical outbound process from first touch to booked meeting.', answer: 'I start with research...', feedback: 'Excellent structure. Trigger event mention shows sophistication. One small thing: "qualifying question before pitching" — name the question or give an example to make it concrete.', score: 90 },
          { question: 'What\'s your proudest prospecting win and what made it work?', answer: 'I booked a meeting with a VP of Sales...', feedback: 'Best answer of the session. Specific, outcome-focused, shows creative thinking. This is exactly what interviewers want to hear.', score: 98 },
          { question: 'How do you handle a prospect who says "just send me some information"?', answer: 'I usually say something like...', feedback: 'Good redirect technique. The follow-up with a specific question rather than a generic one-pager shows experience. Solid.', score: 82 },
          { question: 'What does a bad prospecting day look like for you and how do you recover?', answer: 'A bad day is when I\'m going through the motions...', feedback: 'Self-aware and practical. The "write one really good email" recovery tactic is believable and specific. Good answer.', score: 78 },
          { question: 'How do you prioritise your account list when you have 200 accounts to work?', answer: 'I tier them...', feedback: 'Tiered approach is the right answer and you explained it clearly. Could be slightly more specific about what a "trigger" looks like in practice.', score: 72 },
          { question: 'Tell me about a time you got feedback that was hard to hear.', answer: 'My manager told me my call openings were too long...', feedback: 'One of the better "feedback" answers. You didn\'t deflect, you showed the change you made, and you measured the outcome. That\'s the trifecta.', score: 91 },
          { question: 'Why Nexus over a competitor?', answer: 'Nexus\'s product philosophy aligns...', feedback: 'Good differentiation angle. "Gets used" is a real point — tool adoption is a genuine pain point for buyers. Rings authentic.', score: 81 },
          { question: 'Where do you see yourself in two years?', answer: 'I want to be an Account Executive...', feedback: 'Correct answer. You expressed ambition without sounding like you\'re just using the SDR role as a stepping stone. Balance struck well.', score: 74 },
          { question: 'Do you have any questions for me?', answer: 'What does the ramp look like...', feedback: 'Both questions are smart and show you\'re thinking about success, not just getting the job. Strong close.', score: 88 },
        ],
        patterns: {
          strengths: [
            'Specific, outcome-driven storytelling — you cite real situations rather than generalities',
            'Clear prospecting methodology — you can articulate your process step by step',
            'Genuine product knowledge and belief — comes across as authentic, not rehearsed',
            'Strong self-awareness — you acknowledge weaknesses and show what you did about them',
          ],
          improvements: [
            'Trim answer length by 15–20% — conciseness signals communication skills',
            'Add more specific numbers — quota %, meetings set, pipeline generated',
            'Make your frameworks concrete — name the exact question you ask, the exact email you send',
          ],
        },
        filler_words: { count: 9, examples: ['honestly', 'kind of', 'you know'] },
        talk_time_note: 'Your answers averaged about 90 seconds each — slightly long for an SDR interview where brevity signals communication skill. Aim for 60–75 seconds on most questions.',
      },
    };

    const dryRunVantage = {
      id: DR_VN,
      created_at: _daysFromNow(-5),
      mode: 'company',
      stage: 'Recruiter Screen',
      interview_id: IV_VN,
      history: [
        { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve spent the last year and a half doing outbound in SaaS — mostly prospecting into the SMB and mid-market segments. What draws me to this role specifically is that I\'ve been using Vantage CRM every day, so I\'d be selling a product I actually rely on. I think that\'s a genuinely different kind of credibility when you\'re talking to a prospect.' },
        { question: 'Are you comfortable running high-volume outbound — 80-plus touchpoints per day?', answer: 'Comfortable is almost an understatement. In my current role I\'m running around 90 to 100 touches on a normal day across phone, email, and LinkedIn. I\'ve actually built a morning block system where I batch call activity in the first two hours before email takes over. The volume only works if the structure underneath it is solid.' },
        { question: 'What CRM tools have you used and how deeply did you work in them?', answer: 'Vantage primarily — I use it for pipeline management, activity logging, and pulling call lists. I\'ve also worked in Salesforce briefly. In Vantage specifically I got comfortable building my own views and reports, not just using what my manager set up. I understand the difference between a lead and a contact and why it matters for territory tracking.' },
        { question: 'Walk me through how you research a prospect before your first outreach.', answer: 'I start with the company first — recent news, funding, headcount growth signals on LinkedIn. Then I go to the specific person: their role, how long they\'ve been there, what they post about. I\'m looking for one genuine hook I can lead with. If the company just hired a VP of Sales, that\'s a signal. If the person wrote about pipeline generation, I can reference that specifically.' },
        { question: 'Where do you see yourself in two years?', answer: 'I want to make the move to Account Executive. I\'m not in a rush — I think the SDR year and a half is genuinely where you build the foundation for everything else in sales. But I want to be the kind of SDR who runs enough pipeline and builds enough fluency in the sales conversation that the transition feels earned when it comes.' },
      ],
      report: {
        overall_score: 73,
        summary: 'Solid recruiter screen performance. You came across as grounded and well-prepared, with genuine product familiarity. The volume-handling and CRM answers were notably strong. Main gap: answers occasionally ran long on setup before getting to the core point — lead with your strongest sentence.',
        question_feedback: [
          { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve spent the last year and a half doing outbound in SaaS...', feedback: 'Relevant opening with a good product-credibility hook at the end. The setup ran about 15 seconds longer than it needed to — lead with the product angle first, then add context.', score: 70 },
          { question: 'Are you comfortable running high-volume outbound — 80-plus touchpoints per day?', answer: 'Comfortable is almost an understatement...', feedback: 'Best answer of the session. Specifics on 90-100 touches, a named system (morning block), and the follow-through point about structure making volume work. This is what high-confidence SDR answers sound like.', score: 88 },
          { question: 'What CRM tools have you used and how deeply did you work in them?', answer: 'Vantage primarily...', feedback: 'The detail about building your own views and understanding leads vs. contacts is exactly the right level of specificity. Shows you\'re a practitioner, not a checkbox candidate.', score: 82 },
          { question: 'Walk me through how you research a prospect before your first outreach.', answer: 'I start with the company first...', feedback: 'Good structure (company → person → hook). The VP of Sales hire example is a real trigger signal, which shows you actually think this way. Could have named one more concrete example of a message you\'d send.', score: 74 },
          { question: 'Where do you see yourself in two years?', answer: 'I want to make the move to Account Executive...', feedback: '"Earned when it comes" is a good phrase. The answer is confident without being presumptuous. Slightly generic — a sentence about what specifically about Vantage\'s AE path attracted you would have grounded it.', score: 65 },
        ],
        patterns: {
          strengths: [
            'Specific activity numbers — citing 90-100 daily touches makes your volume answer credible, not vague',
            'Product familiarity at a practitioner level — building your own CRM views shows you\'re a power user',
            'Clean signal-based prospecting framework — company then person then hook is structured and repeatable',
          ],
          improvements: [
            'Lead with your strongest sentence — several answers buried the headline in the middle',
            'Ground your two-year answer in something specific to this company rather than leaving it generic',
            'Add one result metric to the intro — even a rough meetings-set number would raise the opening significantly',
          ],
        },
        filler_words: { count: 6, examples: ['actually', 'specifically', 'kind of'] },
        talk_time_note: 'Answers averaged around 75 seconds — slightly above the ideal 60-second target for a recruiter screen. Practice leading with your conclusion and adding context after.',
      },
    };

    const dryRunCrestline = {
      id: DR_CL,
      created_at: _daysFromNow(-9),
      mode: 'company',
      stage: 'Final Round',
      interview_id: IV_CL,
      history: [
        { question: 'How would you use data to improve your prospecting at Crestline?', answer: 'I\'d start by pulling data on the top five percent of outreach sequences by reply rate. I want to know what patterns appear in the openers and first two minutes of the best calls. Then I\'d compare those against my own sequences in the same time range and find the gaps. The second thing I\'d do is look at drop-off points in my sequences to see where prospects disengage — and redesign those steps. It\'s a continuous feedback loop that most SDRs leave on the table.' },
        { question: 'Tell me about a time you turned a cold prospect into a booked meeting against the odds.', answer: 'I had a VP of Sales who had been in our CRM for eight months with zero engagement across every rep who touched the account. I noticed she\'d just posted on LinkedIn about struggling to get her new SDR team to ramp fast. I sent a two-sentence email: "Saw your post about SDR ramp time — we\'ve helped three similar teams cut ramp from 90 days to 45. Worth a 20-minute call?" She replied in four hours. The key was specificity — I didn\'t pretend to know her problem, I referenced her own words.' },
        { question: 'Describe a failure in your sales career and what you took from it.', answer: 'Early in my current role I had a month where I hit activity targets but missed my meeting quota by 30 percent. I was focused entirely on volume — hitting the number of calls and emails — without asking whether those calls and emails were any good. My manager showed me the data: my connect rate was fine but my conversation-to-meeting rate was half the team average. That was the moment I understood the difference between activity and effectiveness. I rebuilt my call opener and my first email from scratch and recovered over the next two months.' },
        { question: 'How would you pitch Crestline to a prospect who already uses a GTM tool?', answer: 'I\'d ask them what they actually use the tool for day to day. In my experience most GTM tool users are running it for manager review and reporting — they\'re not using it to proactively coach their reps. Then I\'d focus on Crestline\'s workflows: the ability to set up playbooks of winning approaches, automated alerts when a rep misses a key step. The pitch isn\'t "we have better features" — it\'s "you\'re using 20 percent of what your current tool can do, and here\'s what the other 80 percent looks like when a team actually uses it."' },
        { question: 'Walk us through a cold call opening you\'ve used that consistently gets traction.', answer: 'I use a version of the upfront contract open. Something like: "Hi Sarah, this is Alex — completely cold call, is this still a bad time?" The "still" implies it\'s always a bad time, which gets a laugh about 40 percent of the time. Then immediately: "I promise I\'ll be quick — I work with sales teams at companies like yours and I\'ve been seeing a pattern that I thought was worth a quick call. One minute?" If they stay on the line through that, they\'re already curious. I close with a question, not a pitch.' },
      ],
      report: {
        overall_score: 91,
        summary: 'Exceptional final round performance. Every answer was specific, structured, and showed genuine mastery of the craft. The data-driven prospecting answer was particularly impressive — you didn\'t just describe an approach, you explained how you\'d extract value from data that most SDRs ignore. The cold call opening answer closed with a method, not just an example.',
        question_feedback: [
          { question: 'How would you use data to improve your prospecting at Crestline?', answer: 'I\'d start by pulling data on the top five percent...', feedback: 'Outstanding. You named specific data sources, specific actions, and the underlying principle (continuous feedback loop). This answer would stand out in any final round.', score: 96 },
          { question: 'Tell me about a time you turned a cold prospect into a booked meeting against the odds.', answer: 'I had a VP of Sales who had been in our CRM for eight months...', feedback: 'Perfect story structure. The eight-month ghost detail sets stakes. The two-sentence email shows restraint. Closing with "I referenced her own words" shows you understand why it worked.', score: 95 },
          { question: 'Describe a failure in your sales career and what you took from it.', answer: 'Early in my current role I had a month where I hit activity targets but missed my meeting quota by 30 percent...', feedback: 'The activity-versus-effectiveness insight is genuinely good and specific. The recovery arc is slightly over-explained — you can cut two sentences after the "rebuilt from scratch" line.', score: 88 },
          { question: 'How would you pitch Crestline to a prospect who already uses a GTM tool?', answer: 'I\'d ask them what they actually use the tool for day to day...', feedback: '"You\'re using 20 percent of what your current tool can do" is a genuinely effective reframe. Could have named one specific Crestline feature by name to ground the pitch more concretely.', score: 89 },
          { question: 'Walk us through a cold call opening you\'ve used that consistently gets traction.', answer: 'I use a version of the upfront contract open...', feedback: 'The "still a bad time" framing is memorable and the 40% laugh rate is a credible detail. Ending with "I close with a question, not a pitch" shows you understand the principle, not just the script. Strong close to the session.', score: 93 },
        ],
        patterns: {
          strengths: [
            'Data-driven thinking — you instinctively reference metrics to support every claim',
            'Principle-based answers — you explain why your approaches work, not just what you do',
            'Story structure — your prospecting win had clear stakes, specific action, and a replicable insight',
            'Strong self-awareness — activity vs. effectiveness insight shows real growth',
          ],
          improvements: [
            'Trim the recovery arc in failure stories — once you show the fix worked, stop',
            'Name specific features or workflows when pitching a product — concrete beats abstract',
            'The competitive pitch could benefit from one quantified customer story',
          ],
        },
        filler_words: { count: 3, examples: ['kind of', 'actually'] },
        talk_time_note: 'Answer length was well-controlled throughout — most responses hit the 75–90 second range appropriate for a final round. The failure story ran slightly long; trim the recovery section to keep it under 90 seconds.',
      },
    };

    // ── Community Questions ───────────────────────────────────────────────────────
    const communityQuestions = {
      'vantage.io': [
        { question: 'Tell me about yourself and what draws you to an SDR role.', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-45) },
        { question: 'What do you know about Vantage and why do you want to work here specifically?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-38) },
        { question: 'Are you comfortable with high-volume outbound — 80-plus touchpoints per day?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-30) },
        { question: 'What CRM tools have you used and how deeply did you work inside them?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-22) },
        { question: 'Walk me through your background and how it prepares you for this role.', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-14) },
        { question: 'Where do you see yourself in two years?', interview_stage: 'Recruiter Screen', created_at: _daysFromNow(-7) },
      ],
      'nexus.ai': [
        { question: 'Walk me through your outbound prospecting process from first touch to booked meeting.', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-60) },
        { question: 'How do you handle a prospect who says they\'re not interested?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-52) },
        { question: 'Tell me about a time you exceeded your activity or quota targets.', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-44) },
        { question: 'How do you prioritize your account list when you have hundreds of accounts to work?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-36) },
        { question: 'What\'s your approach to cold email copywriting — what makes a good subject line?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-28) },
        { question: 'How do you stay motivated during a tough prospecting week?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-20) },
        { question: 'How do you research a prospect before reaching out?', interview_stage: 'Hiring Manager', created_at: _daysFromNow(-12) },
      ],
      'meridian.io': [
        { question: 'How do you use data and analytics to iterate on your outreach sequences?', interview_stage: 'Final Round', created_at: _daysFromNow(-90) },
        { question: 'Give me an example of a creative prospecting approach that got a reply when nothing else had.', interview_stage: 'Final Round', created_at: _daysFromNow(-75) },
        { question: 'How do you handle the "send me some information" brush-off on a cold call?', interview_stage: 'Final Round', created_at: _daysFromNow(-60) },
        { question: 'What does your ideal prospecting day look like hour by hour?', interview_stage: 'Final Round', created_at: _daysFromNow(-50) },
        { question: 'Why Meridian over other sales engagement companies?', interview_stage: 'Final Round', created_at: _daysFromNow(-40) },
        { question: 'Tell me about a time you missed your target and how you got back on track.', interview_stage: 'Final Round', created_at: _daysFromNow(-30) },
        { question: 'Where do you see yourself in 18 months and how does this role get you there?', interview_stage: 'Final Round', created_at: _daysFromNow(-18) },
      ],
      'crestline.com': [
        { question: 'How would you use data to improve your prospecting?', interview_stage: 'Panel', created_at: _daysFromNow(-120) },
        { question: 'Tell me about a time you turned a cold prospect into a booked meeting against the odds.', interview_stage: 'Panel', created_at: _daysFromNow(-105) },
        { question: 'Describe a failure in your sales career and what you took from it.', interview_stage: 'Panel', created_at: _daysFromNow(-90) },
        { question: 'How do you research enterprise accounts before building a sequence?', interview_stage: 'Panel', created_at: _daysFromNow(-75) },
        { question: 'How would you pitch Crestline to a prospect who already uses a GTM tool?', interview_stage: 'Panel', created_at: _daysFromNow(-60) },
        { question: 'Walk us through a cold call opening you\'ve used that consistently gets traction.', interview_stage: 'Panel', created_at: _daysFromNow(-45) },
        { question: 'What metrics do you use to judge whether your outreach is working?', interview_stage: 'Panel', created_at: _daysFromNow(-30) },
      ],
    };

    // ── Settings / Profile ────────────────────────────────────────────────────────
    const settings = { notifications_enabled: true };

    const profile = {
      completed: true,
      role_type: 'AE', experience_years: '3–5 years',
      company_size: ['Scale-up (51–500)', 'Mid-market (501–2000)'],
      challenge: ['Structuring my answers', 'Nerves & confidence'],
      job_search_status: 'Actively interviewing',
      strongest_asset: 'Consistent quota attainment',
      improvement_area: 'Compensation negotiation',
      tools: 'Vantage, Meridian, Nexus',
      salary_range: 'USD $120,000 – $150,000',
      additional_context: '[screenshot data]',
    };

    // ── Company cache (pre-seed overview for screenshot companies) ────────────────
    const companyCache = {
      'meridian.io': {
        org: {
          short_description: 'Meridian is a sales engagement platform built for mid-market outbound teams. The platform combines multi-channel sequencing, AI-assisted personalization, and real-time analytics to help SDRs book more meetings with less guesswork. Meridian is used by over 600 revenue teams across North America and Europe.',
          industry: 'Software',
          estimated_num_employees: 280,
          founded_year: 2018,
          city: 'Austin',
          state: 'TX',
          country: 'US',
        },
      },
    };

    // ── Write to localStorage ─────────────────────────────────────────────────────
    localStorage.setItem('klinch_setup_complete',           '1');
    localStorage.setItem('klinch_profile',                  JSON.stringify(profile));
    localStorage.setItem('klinch_interviews',               JSON.stringify(interviews));
    localStorage.setItem('klinch_processes',                JSON.stringify(processes));
    localStorage.setItem('klinch_applications',             JSON.stringify(applications));
    localStorage.setItem('klinch_resume',                   JSON.stringify(resume));
    localStorage.setItem('klinch_dry_runs',                 JSON.stringify([dryRunNexus, dryRunVantage, dryRunCrestline]));
    localStorage.setItem('klinch_settings',                 JSON.stringify(settings));
    localStorage.setItem('klinch_dev_community_questions',  JSON.stringify(communityQuestions));
    localStorage.setItem('klinch_company_cache',            JSON.stringify(companyCache));
  }

})();
