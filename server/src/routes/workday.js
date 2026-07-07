import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';
import { politeFetch } from '../discovery/fetcher.js';
import { parseWorkdayUrl, fetchJobDetail, bootstrapCookies, stripHtml } from '../discovery/adapters/workday.js';

const router = Router();

// ---------------------------------------------------------------------------
// Application form template. Workday applications are highly standardized —
// the same four sections appear on virtually every tenant. We build the
// preview from that template (plus posting-specific hints) rather than
// scraping the live form, and are explicit that the live form may add
// company-specific questions on top.
// ---------------------------------------------------------------------------

const PREVIEW_NOTE =
  'Template-based preview: Workday application forms are highly standardized, but the live form may add ' +
  'company-specific questions (and exact dropdown options vary by tenant). The co-pilot handles those in the browser.';

function field(section, key, label, type = 'text', options) {
  return { key, section, label, type, ...(options ? { options } : {}) };
}

function buildSections(job, detail) {
  const company = job.company || 'this company';
  const country = detail?.country || 'the country of the job location';
  const descText = `${detail?.description_text || job.description || ''}`.toLowerCase();

  const myInfo = {
    id: 'my_information',
    title: 'My Information',
    fields: [
      field('my_information', 'how_did_you_hear', 'How did you hear about us?', 'select',
        ['Company Website', 'Job Board', 'LinkedIn', 'Referral', 'University / Campus', 'Social Media', 'Other']),
      field('my_information', 'previously_worked', `Have you previously worked for ${company}?`, 'select', ['Yes', 'No']),
      field('my_information', 'country', 'Country'),
      field('my_information', 'legal_first_name', 'Legal first name'),
      field('my_information', 'legal_last_name', 'Legal last name'),
      field('my_information', 'preferred_name', 'Preferred name (optional)'),
      field('my_information', 'address_line_1', 'Address line 1'),
      field('my_information', 'city', 'City'),
      field('my_information', 'state_region', 'State / Province / Region'),
      field('my_information', 'postal_code', 'Postal code'),
      field('my_information', 'email', 'Email address'),
      field('my_information', 'phone_device_type', 'Phone device type', 'select', ['Mobile', 'Home', 'Work']),
      field('my_information', 'phone_country_code', 'Country phone code (e.g. +1)'),
      field('my_information', 'phone_number', 'Phone number'),
    ],
  };

  const expFields = [];
  for (let n = 1; n <= 3; n++) {
    expFields.push(
      field('my_experience', `work_${n}_job_title`, `Work experience ${n} — Job title`),
      field('my_experience', `work_${n}_company`, `Work experience ${n} — Company`),
      field('my_experience', `work_${n}_location`, `Work experience ${n} — Location`),
      field('my_experience', `work_${n}_from`, `Work experience ${n} — From (MM/YYYY)`),
      field('my_experience', `work_${n}_to`, `Work experience ${n} — To (MM/YYYY, blank if current)`),
      field('my_experience', `work_${n}_description`, `Work experience ${n} — Role description`, 'textarea'),
    );
  }
  for (let n = 1; n <= 2; n++) {
    expFields.push(
      field('my_experience', `education_${n}_school`, `Education ${n} — School / University`),
      field('my_experience', `education_${n}_degree`, `Education ${n} — Degree`),
      field('my_experience', `education_${n}_field_of_study`, `Education ${n} — Field of study`),
      field('my_experience', `education_${n}_gpa`, `Education ${n} — GPA (optional)`),
      field('my_experience', `education_${n}_years`, `Education ${n} — Years (e.g. 2019 - 2023)`),
    );
  }
  expFields.push(
    field('my_experience', 'skills', 'Skills (comma-separated)', 'textarea'),
    field('my_experience', 'linkedin', 'LinkedIn URL'),
    field('my_experience', 'website_1', 'Website / portfolio URL'),
    field('my_experience', 'resume_upload', 'Resume / CV upload', 'file'),
  );
  const myExperience = {
    id: 'my_experience',
    title: 'My Experience',
    note: 'Workday lets you add unlimited work/education entries; the template previews the first few. The resume upload is attached manually in the browser.',
    fields: expFields,
  };

  // Application questions: two near-universal ones plus posting-specific hints
  // extracted from the job description when detectable.
  const qFields = [
    field('application_questions', 'work_authorization', `Are you legally authorized to work in ${country}?`, 'select', ['Yes', 'No']),
    field('application_questions', 'sponsorship', 'Will you now or in the future require visa sponsorship?', 'select', ['Yes', 'No']),
  ];
  const hints = [
    [/clearance/, 'security_clearance', 'Do you hold an active security clearance?', 'select', ['Yes', 'No']],
    [/relocat/, 'relocation', 'Are you willing to relocate for this role?', 'select', ['Yes', 'No']],
    [/\btravel\b/, 'travel', 'Are you willing to travel as required by the role?', 'select', ['Yes', 'No']],
    [/driver'?s licen[cs]e/, 'drivers_license', 'Do you have a valid driver’s license?', 'select', ['Yes', 'No']],
    [/\b(hybrid|on-?site)\b/, 'onsite', 'Are you able to work on-site / hybrid as required?', 'select', ['Yes', 'No']],
    [/salary|compensation expectation/, 'salary_expectation', 'What are your salary expectations?'],
    [/start date|available to start/, 'earliest_start_date', 'What is your earliest available start date?'],
  ];
  for (const [re, key, label, type, options] of hints) {
    if (re.test(descText)) qFields.push(field('application_questions', key, label, type, options));
  }
  const questions = {
    id: 'application_questions',
    title: 'Application Questions',
    note: 'These are educated guesses from the standard template plus hints found in the posting text. The live form is authoritative and may ask different, company-specific questions.',
    fields: qFields,
  };

  const voluntary = {
    id: 'voluntary_disclosures',
    title: 'Voluntary Disclosures / Self-Identify',
    note: 'Optional in the real form — you may decline to answer any of these.',
    fields: [
      field('voluntary_disclosures', 'gender', 'Gender', 'select', ['Male', 'Female', 'I do not wish to disclose']),
      field('voluntary_disclosures', 'ethnicity', 'Race / ethnicity (US EEO categories)'),
      field('voluntary_disclosures', 'veteran_status', 'Veteran status', 'select', [
        'I am not a protected veteran',
        'I identify as one or more of the classifications of protected veteran',
        'I do not wish to answer',
      ]),
      field('voluntary_disclosures', 'disability_status', 'Disability status', 'select', [
        'Yes, I have a disability, or have had one in the past',
        'No, I do not have a disability and have not had one in the past',
        'I do not want to answer',
      ]),
    ],
  };

  return [myInfo, myExperience, questions, voluntary];
}

// ---------------------------------------------------------------------------
// AI prefill (same Gemini pattern as copilot.js mapFields) + heuristic fallback
// ---------------------------------------------------------------------------

const prefillSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      value: { type: 'string' },
    },
    required: ['key', 'value'],
  },
};

async function prefillWithAI(fields, profile, jobContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are prefilling a Workday job application form for a candidate. Given the form fields and the candidate profile, return the value for each field you can confidently fill. Skip fields you cannot map (don't include them). Never invent data not present in the profile. For select fields, the value must EXACTLY match one of the listed options. Dates use the format shown in the field label.

JOB CONTEXT:
${JSON.stringify(jobContext, null, 2)}

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

FORM FIELDS (key, type, label, options):
${fields.map((f) => `- ${f.key} [${f.type}] "${f.label}"${f.options?.length ? ` options: ${f.options.join(' / ')}` : ''}`).join('\n')}

Return a JSON array of {key, value}.`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', responseSchema: prefillSchema },
  });
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

/** Deterministic, conservative prefill straight from the profile vault (no LLM). */
function prefillHeuristic(profile) {
  const out = [];
  const put = (key, value) => { if (value) out.push({ key, value: String(value) }); };
  const name = String(profile.full_name || '').trim().split(/\s+/);
  put('legal_first_name', name[0]);
  put('legal_last_name', name.length > 1 ? name.slice(1).join(' ') : '');
  put('email', profile.email);
  put('phone_number', profile.phone);
  put('phone_device_type', profile.phone ? 'Mobile' : '');
  const loc = String(profile.location || '').split(',').map((s) => s.trim());
  put('city', loc[0]);
  put('state_region', loc[1]);
  put('linkedin', profile.linkedin);
  put('website_1', profile.website);
  put('education_1_school', profile.university);
  put('education_1_degree', profile.degree);
  return out;
}

// ---------------------------------------------------------------------------
// Persistence helpers — answers stored as [{key, label, section?, value}]
// so the co-pilot can match saved answers against live form labels.
// ---------------------------------------------------------------------------

function loadAnswersRow(jobId) {
  const row = db.prepare('SELECT data, date_updated FROM application_answers WHERE job_id = ?').get(jobId);
  if (!row) return { answers: [], date_updated: null };
  let answers = [];
  try {
    answers = JSON.parse(row.data);
  } catch { /* corrupt row — treat as empty */ }
  return { answers: Array.isArray(answers) ? answers : [], date_updated: row.date_updated };
}

function sanitizeAnswers(input) {
  if (!Array.isArray(input)) return null;
  return input
    .filter((a) => a && typeof a === 'object' && typeof a.key === 'string' && a.key)
    .map((a) => ({
      key: a.key.slice(0, 100),
      label: String(a.label || a.key).slice(0, 300),
      section: a.section ? String(a.section).slice(0, 60) : undefined,
      value: String(a.value ?? '').slice(0, 4000),
    }));
}

/** Turn {key, value} pairs into full answer records using the template fields. */
function toAnswerRecords(pairs, sections) {
  const byKey = new Map();
  for (const s of sections) for (const f of s.fields) byKey.set(f.key, f);
  const out = [];
  for (const p of pairs) {
    const f = byKey.get(p.key);
    if (!f || !p.value) continue;
    if (f.type === 'select' && f.options && !f.options.includes(p.value)) continue;
    out.push({ key: f.key, label: f.label, section: f.section, value: String(p.value) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/workday/preview/:jobId[?regenerate=1]
router.get('/preview/:jobId', async (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM discovered_jobs WHERE id = ?').get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const parsed = parseWorkdayUrl(job.url);
    if (!parsed) return res.status(400).json({ error: 'Not a myworkdayjobs.com posting URL' });
    if (!parsed.externalPath) return res.status(400).json({ error: 'Workday URL has no job path — cannot fetch posting detail' });

    // Fetch posting detail from the CXS API (best-effort — preview still works without it).
    let postingDetail = null;
    let detailError = null;
    try {
      const cookies = await bootstrapCookies(parsed.base, parsed.site, politeFetch);
      const info = await fetchJobDetail(parsed, { doFetch: politeFetch, cookies });
      postingDetail = {
        title: info.title || null,
        job_req_id: info.jobReqId || null,
        posted_on: info.postedOn || null,
        start_date: info.startDate || null,
        location: info.location || null,
        additional_locations: info.additionalLocations || null,
        time_type: info.timeType || null,
        country: info.country?.descriptor || null,
        qualifications: info.qualifications || null,
        description_html: info.jobDescription || null,
        description_text: stripHtml(info.jobDescription) || null,
      };
      // Cache the description on the discovered job if we don't have one yet.
      if (postingDetail.description_text && !job.description) {
        job.description = postingDetail.description_text.slice(0, 8000);
        db.prepare('UPDATE discovered_jobs SET description = ? WHERE id = ?').run(job.description, job.id);
      }
      if (postingDetail.start_date && !job.posted_date) {
        db.prepare('UPDATE discovered_jobs SET posted_date = ? WHERE id = ?').run(postingDetail.start_date, job.id);
      }
    } catch (err) {
      detailError = err.message;
    }

    const sections = buildSections(job, postingDetail);

    // Answers: saved > AI prefill > heuristic prefill. ?regenerate=1 forces a fresh AI pass.
    const regenerate = req.query.regenerate === '1' || req.query.regenerate === 'true';
    const saved = loadAnswersRow(job.id);
    let answers;
    let answersSource;
    let aiError = null;
    if (saved.answers.length && !regenerate) {
      answers = saved.answers;
      answersSource = 'saved';
    } else {
      const profileRow = db.prepare('SELECT data FROM profile WHERE id = 1').get();
      const profile = profileRow ? JSON.parse(profileRow.data) : {};
      const flatFields = sections.flatMap((s) => s.fields).filter((f) => f.type !== 'file');
      let pairs;
      try {
        pairs = await prefillWithAI(flatFields, profile, {
          company: job.company,
          role: job.role,
          location: postingDetail?.location || job.location,
          country: postingDetail?.country || null,
          description_excerpt: (postingDetail?.description_text || job.description || '').slice(0, 2000),
        });
        answersSource = 'ai';
      } catch (err) {
        aiError = err.message;
        pairs = prefillHeuristic(profile);
        answersSource = 'heuristic';
      }
      answers = toAnswerRecords(pairs, sections);
    }

    res.json({
      job: { id: job.id, company: job.company, role: job.role, url: job.url, location: job.location },
      workday: { tenant: parsed.tenant, site: parsed.site, wd: parsed.wd },
      posting_detail: postingDetail,
      detail_error: detailError,
      sections,
      answers,
      answers_source: answersSource,
      ai_error: aiError,
      note: PREVIEW_NOTE,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workday/answers/:jobId
router.get('/answers/:jobId', (req, res) => {
  const job = db.prepare('SELECT id FROM discovered_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { answers, date_updated } = loadAnswersRow(job.id);
  res.json({ job_id: job.id, answers, date_updated });
});

// PUT /api/workday/answers/:jobId  body: { answers: [{key, label, section?, value}] }
router.put('/answers/:jobId', (req, res) => {
  const job = db.prepare('SELECT id FROM discovered_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const answers = sanitizeAnswers(req.body?.answers);
  if (!answers) return res.status(400).json({ error: 'Body must be { answers: [{key, label, value}, …] }' });
  db.prepare(`
    INSERT INTO application_answers (job_id, data, date_updated) VALUES (?, ?, datetime('now'))
    ON CONFLICT(job_id) DO UPDATE SET data = excluded.data, date_updated = datetime('now')
  `).run(job.id, JSON.stringify(answers));
  const saved = loadAnswersRow(job.id);
  res.json({ job_id: job.id, answers: saved.answers, date_updated: saved.date_updated });
});

export default router;
