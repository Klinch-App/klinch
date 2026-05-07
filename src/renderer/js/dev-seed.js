(() => {
  if (!window.klinch?.isDev) return;

  // Show the dev section in Settings
  const devSection = document.getElementById('st-dev-section');
  if (devSection) devSection.style.display = '';

  document.getElementById('st-seed-btn')?.addEventListener('click', () => {
    if (!confirm('This will wipe all existing Klinch data and load seed data. Continue?')) return;
    _load();
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
    const IV_SF   = _uuid();
    const IV_HB   = _uuid();
    const IV_OUT  = _uuid();
    const IV_GONG = _uuid();
    const AP_SF   = _uuid();
    const AP_HB   = _uuid();
    const AP_OUT  = _uuid();
    const AP_GONG = _uuid();
    const DR_ID   = _uuid();

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
        created_at: _daysFromNow(-3),
      },
      {
        id: IV_HB,
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
        created_at: _daysFromNow(-7),
      },
      {
        id: IV_OUT,
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
        created_at: _daysFromNow(-14),
        coach_analysis: `**What You Did Well**
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
        created_at: _daysFromNow(-21),
        coach_analysis: `**What You Did Well**
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
    ];

    // ── Applications ───────────────────────────────────────────────────────────
    const applications = [
      {
        id: AP_SF,
        company: SALESFORCE,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-3),
        date_first_interview: _dateStr(1),
        status: 'Interviewing',
        current_stage: 'Recruiter Screen',
        jd: null,
        notes: '',
        interview_ids: [IV_SF],
        created_at: _daysFromNow(-3),
        updated_at: _daysFromNow(-3),
      },
      {
        id: AP_HB,
        company: HUBSPOT,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-7),
        date_first_interview: _dateStr(-7),
        status: 'Interviewing',
        current_stage: 'Hiring Manager',
        jd: null,
        notes: '',
        interview_ids: [IV_HB],
        created_at: _daysFromNow(-7),
        updated_at: _daysFromNow(-7),
      },
      {
        id: AP_OUT,
        company: OUTREACH,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-14),
        date_first_interview: _dateStr(-14),
        status: 'Interviewing',
        current_stage: 'Final Round',
        jd: null,
        notes: '',
        interview_ids: [IV_OUT],
        created_at: _daysFromNow(-14),
        updated_at: _daysFromNow(-5),
      },
      {
        id: AP_GONG,
        company: GONG,
        role_title: 'Sales Development Representative',
        date_applied: _dateStr(-21),
        date_first_interview: _dateStr(-21),
        status: 'Rejected',
        current_stage: 'Panel',
        jd: null,
        notes: '',
        interview_ids: [IV_GONG],
        created_at: _daysFromNow(-21),
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
      role_fits: {},
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
        overall_score: 8,
        summary: 'Strong overall performance. You came across as confident, well-prepared, and genuinely interested in the role rather than just the job. The standout moments were your specific prospecting win story and the self-aware answer about hard feedback. Main area to tighten: a couple of answers ran slightly long — SDR interviewers are looking for concise, punchy communication.',
        question_feedback: [
          { question: 'Tell me about yourself and why you\'re interested in the SDR role here.', answer: 'I\'ve been in sales for about a year and a half now...', feedback: 'Clean and confident opening. Good that you connected your interest to the product specifically — that\'s more convincing than "I love the brand." Could trim by 20 seconds.', score: 8 },
          { question: 'Walk me through your typical outbound process from first touch to booked meeting.', answer: 'I start with research...', feedback: 'Excellent structure. Trigger event mention shows sophistication. One small thing: "qualifying question before pitching" — name the question or give an example to make it concrete.', score: 9 },
          { question: 'What\'s your proudest prospecting win and what made it work?', answer: 'I booked a meeting with a VP of Sales...', feedback: 'Best answer of the session. Specific, outcome-focused, shows creative thinking. This is exactly what interviewers want to hear.', score: 10 },
          { question: 'How do you handle a prospect who says "just send me some information"?', answer: 'I usually say something like...', feedback: 'Good redirect technique. The follow-up with a specific question rather than a generic one-pager shows experience. Solid.', score: 8 },
          { question: 'What does a bad prospecting day look like for you and how do you recover?', answer: 'A bad day is when I\'m going through the motions...', feedback: 'Self-aware and practical. The "write one really good email" recovery tactic is believable and specific. Good answer.', score: 8 },
          { question: 'How do you prioritise your account list when you have 200 accounts to work?', answer: 'I tier them...', feedback: 'Tiered approach is the right answer and you explained it clearly. Could be slightly more specific about what a "trigger" looks like in practice.', score: 7 },
          { question: 'Tell me about a time you got feedback that was hard to hear.', answer: 'My manager told me my call openings were too long...', feedback: 'One of the better "feedback" answers. You didn\'t deflect, you showed the change you made, and you measured the outcome. That\'s the trifecta.', score: 9 },
          { question: 'Why HubSpot over a competitor like Salesforce or another CRM company?', answer: 'Honestly, HubSpot\'s product philosophy aligns...', feedback: 'Good differentiation angle. "Gets used" is a real point — tool adoption is a genuine pain point for buyers. Rings authentic.', score: 8 },
          { question: 'Where do you see yourself in two years?', answer: 'I want to be an Account Executive...', feedback: 'Correct answer. You expressed ambition without sounding like you\'re just using the SDR role as a stepping stone. Balance struck well.', score: 7 },
          { question: 'Do you have any questions for me?', answer: 'What does the ramp look like...', feedback: 'Both questions are smart and show you\'re thinking about success, not just getting the job. Strong close.', score: 9 },
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
    localStorage.setItem('klinch_setup_complete', '1');
    localStorage.setItem('klinch_profile',        JSON.stringify(profile));
    localStorage.setItem('klinch_interviews',     JSON.stringify(interviews));
    localStorage.setItem('klinch_applications',   JSON.stringify(applications));
    localStorage.setItem('klinch_resume',         JSON.stringify(resume));
    localStorage.setItem('klinch_dry_runs',       JSON.stringify([dryRun]));
    localStorage.setItem('klinch_settings',       JSON.stringify(settings));
  }

})();
