// CreepScore analyzer — a transparent, rule-based report card for the fine print.
// Two rubrics: PRIVACY (what they do with your data) and TERMS OF SERVICE (how
// they can screw you legally). Pure function, no network, no dependencies: runs
// identically in the browser and in Node tests. Every point traces back to a
// matched clause, so the result is auditable — no AI black box.

/**
 * Each dimension starts at `base` (0-100, higher = more user-friendly) and each
 * matched signal nudges it by `delta`. `kind` is for UI colouring only.
 */
export const PRIVACY_RUBRIC = [
  {
    id: "sharing",
    label: "Third-party sharing & selling",
    weight: 0.25,
    base: 80,
    signals: [
      { label: "Sells your personal information", kind: "bad", delta: -34,
        re: /\b(we\s+(may\s+)?sell|sale of|sold|sell your)\b[^.]{0,40}\b(personal|information|data)\b/i },
      { label: "Shares data with third parties", kind: "bad", delta: -16,
        re: /\bshare[^.]{0,70}\bthird[- ]?part/i },
      { label: "Shares with advertising / marketing partners", kind: "bad", delta: -13,
        re: /\b(advertising|marketing)\s+(partners|networks|companies|providers)\b/i },
      { label: "Shares with affiliates", kind: "bad", delta: -6, re: /\baffiliates\b/i },
      { label: "Mentions data brokers", kind: "bad", delta: -14, re: /\bdata\s+brokers?\b/i },
      { label: "States it does NOT sell your data", kind: "good", delta: +26,
        re: /\b(do not sell|don'?t sell|never sell|we do not sell|not for sale)\b/i },
      { label: "States it does NOT share your data", kind: "good", delta: +12,
        re: /\b(we\s+(do not|don'?t|never)\s+share)\b/i },
    ],
  },
  {
    id: "collection",
    label: "Data collection breadth",
    weight: 0.22,
    base: 96,
    signals: [
      { label: "Collects little or no personal data", kind: "good", delta: +12,
        re: /\b(we (do not|don'?t|never) (collect|store|retain)|cannot be accessed|collect (very )?little|no personal (data|information) (is )?collected|minimal (data|information))\b/i },
      { label: "Collects precise location", kind: "bad", delta: -16,
        re: /\b(precise location|geo[- ]?location|gps|location (data|information)|your location)\b/i },
      { label: "Collects biometric data", kind: "bad", delta: -16, re: /\bbiometric/i },
      { label: "Collects health / medical data", kind: "bad", delta: -11,
        re: /\b(health (data|information)|medical (data|information|history))\b/i },
      { label: "Collects financial / payment data", kind: "bad", delta: -7,
        re: /\b(financial information|payment (information|details)|credit card|bank account)\b/i },
      { label: "Accesses your contacts", kind: "bad", delta: -11,
        re: /\b(your contacts|address book|contact list|phone book)\b/i },
      { label: "Tracks browsing / search activity", kind: "bad", delta: -12,
        re: /\b(browsing (history|activity)|websites you visit|search (history|queries)|sites you visit)\b/i },
      { label: "Collects device identifiers / IP", kind: "bad", delta: -8,
        re: /\b(device (identifier|id)s?|ip address|advertising id|unique (device )?identifier)\b/i },
      { label: "Accesses camera / microphone / photos", kind: "bad", delta: -8,
        re: /\b(camera|microphone|your photos|your media|image and audio)\b/i },
      { label: "Acquires data about you from other sources", kind: "bad", delta: -9,
        re: /\b(obtain|receive|collect)[^.]{0,50}\bfrom\b[^.]{0,30}\b(third part|other sources|partners|brokers)\b/i },
    ],
  },
  {
    id: "tracking",
    label: "Tracking & targeted advertising",
    weight: 0.18,
    base: 88,
    signals: [
      { label: "Uses cookies / tracking technologies", kind: "bad", delta: -7,
        re: /\b(cookies|tracking technolog|web beacons|tracking pixels?)\b/i },
      { label: "Serves targeted / personalized ads", kind: "bad", delta: -16,
        re: /\b(targeted|personali[sz]ed|interest[- ]based|behavio(u)?ral)\s+(ads|advertising|advertisements)\b/i },
      { label: "Tracks you across sites / devices", kind: "bad", delta: -13, re: /\bcross[- ](site|device|app)\b/i },
      { label: "Builds a profile about you", kind: "bad", delta: -10, re: /\bprofil(e|ing|es)\b/i },
      { label: "Allows third-party trackers", kind: "bad", delta: -10, re: /\bthird[- ]party (cookies|trackers|tracking|advertis)/i },
      { label: "Does NOT track you", kind: "good", delta: +24,
        re: /\b(we (do not|don'?t) track|no tracking|we don'?t use cookies|we don'?t collect)\b/i },
      { label: "No third-party cookies", kind: "good", delta: +10, re: /\bno third[- ]party cookies\b/i },
    ],
  },
  {
    id: "rights",
    label: "Your rights & control",
    weight: 0.12,
    base: 45,
    signals: [
      { label: "Right to access your data", kind: "good", delta: +11,
        re: /\b(right to (access|know)|access (to )?your (personal )?(data|information))\b/i },
      { label: "Right to delete your data", kind: "good", delta: +13,
        re: /\b(right to (delete|erasure)|delete your (data|account|information)|request deletion)\b/i },
      { label: "Opt-out controls", kind: "good", delta: +9, re: /\bopt[- ]?out\b/i },
      { label: "Data portability", kind: "good", delta: +6, re: /\b(data portability|export your data)\b/i },
      { label: "Honours GDPR / CCPA", kind: "good", delta: +11, re: /\b(gdpr|ccpa|cpra|general data protection regulation)\b/i },
      { label: "Lets you withdraw consent", kind: "good", delta: +7, re: /\bwithdraw (your )?consent\b/i },
    ],
  },
  {
    id: "retention",
    label: "Data retention",
    weight: 0.10,
    base: 58,
    signals: [
      { label: "Specifies concrete retention periods", kind: "good", delta: +16, re: /\b\d+\s*(days|months|years)\b/i },
      { label: "Deletes data when you ask / close account", kind: "good", delta: +8,
        re: /\b(until you (delete|request)|when you (delete|close)|upon (deletion|request))\b/i },
      { label: "Vague retention ('as long as necessary')", kind: "bad", delta: -12,
        re: /\b(as long as (necessary|needed)|for as long as|retain[^.]{0,40}necessary)\b/i },
    ],
  },
  {
    id: "security",
    label: "Security",
    weight: 0.10,
    base: 52,
    signals: [
      { label: "End-to-end encryption", kind: "good", delta: +34, re: /\bend[- ]to[- ]end encrypt/i },
      { label: "Encrypts your data", kind: "good", delta: +13, re: /\bencrypt(ion|ed|s)?\b/i },
      { label: "Describes security safeguards", kind: "good", delta: +7,
        re: /\b(security measures|safeguards|protect your (data|information)|reasonable security)\b/i },
    ],
  },
];

export const TOS_RUBRIC = [
  {
    id: "disputes",
    label: "Your right to sue",
    weight: 0.22,
    base: 82,
    signals: [
      { label: "Forces binding arbitration (you can't sue in court)", kind: "bad", delta: -30, re: /\b(binding )?arbitration\b/i },
      { label: "Waives your right to a class action", kind: "bad", delta: -16,
        re: /\b(class[- ]action waiver|waiv[^.]{0,30}class action|no class actions?|class action waiver|on an individual basis)\b/i },
      { label: "Waives your right to a jury trial", kind: "bad", delta: -10, re: /\bwaiv[^.]{0,30}(jury|trial)\b/i },
      { label: "Shortens the time you have to bring a claim", kind: "bad", delta: -11,
        re: /\b((within|after) (one|1|two|2|ninety|90|180) (year|days)[^.]{0,40}(claim|action|file|bring)|claim[^.]{0,40}(within|barred))\b/i },
      { label: "Lets you opt out of arbitration", kind: "good", delta: +18, re: /\bopt[- ]?out of (the )?arbitration\b/i },
    ],
  },
  {
    id: "ip",
    label: "Rights to your content",
    weight: 0.15,
    base: 80,
    signals: [
      { label: "Takes a broad license to your content", kind: "bad", delta: -22,
        re: /\b(perpetual|irrevocable|worldwide|royalty[- ]free|sub[- ]?licensable|transferable)\b[^.]{0,90}\blicens/i },
      { label: "Licenses the content you post", kind: "bad", delta: -10,
        re: /\blicen[sc]e[^.]{0,70}(your content|user content|content you (post|submit|upload)|materials you)\b/i },
      { label: "May use your content for any purpose", kind: "bad", delta: -10,
        re: /\b(use|reproduce|modify|distribute|display)[^.]{0,60}(your content|user content)[^.]{0,40}(any purpose|commercial)\b/i },
      { label: "Confirms you keep ownership of your content", kind: "good", delta: +20,
        re: /\b(you (retain|keep|own)[^.]{0,40}(ownership|rights|your content|intellectual property)|we (claim|take) no ownership)\b/i },
    ],
  },
  {
    id: "changes",
    label: "Can they change the deal on you?",
    weight: 0.13,
    base: 60,
    signals: [
      { label: "Can change the terms unilaterally", kind: "bad", delta: -18,
        re: /\b(we (may|reserve the right to)|right to)\s+(modify|change|update|amend|revise)[^.]{0,50}(these terms|the terms|this agreement|at any time)/i },
      { label: "Continued use means you accept new terms", kind: "bad", delta: -10,
        re: /\b(continued? (use|access)|by continuing)[^.]{0,60}(accept|agree|bound)\b/i },
      { label: "Can change or discontinue the service anytime", kind: "bad", delta: -7,
        re: /\b(modify|discontinue|suspend|change)[^.]{0,40}(the (service|product|app)|any (feature|part))[^.]{0,30}(at any time|without notice)\b/i },
      { label: "Promises to notify you of changes", kind: "good", delta: +12,
        re: /\b(notify|notice|inform you)[^.]{0,45}(changes|modifications|update)/i },
    ],
  },
  {
    id: "termination",
    label: "Account termination",
    weight: 0.10,
    base: 66,
    signals: [
      { label: "Can terminate your account at will", kind: "bad", delta: -18,
        re: /\bterminat[^.]{0,70}(at any time|for any reason|without notice|sole discretion)\b/i },
      { label: "No liability to you for termination", kind: "bad", delta: -7,
        re: /\b(terminat|suspend)[^.]{0,50}(without (any )?liability|no liability)\b/i },
      { label: "Gives notice / appeal before termination", kind: "good", delta: +9,
        re: /\b(notice (of|before|prior to) (termination|suspension)|appeal[^.]{0,30}(termination|suspension|decision))\b/i },
    ],
  },
  {
    id: "liability",
    label: "Liability & warranties",
    weight: 0.12,
    base: 74,
    signals: [
      { label: 'Provided "as is" with no warranty', kind: "bad", delta: -8, re: /\b("as is"|as is\b|without warrant|no warrant|disclaim[^.]{0,30}warrant)/i },
      { label: "Caps or disclaims their liability", kind: "bad", delta: -8, re: /\b(limitation of liability|limit[^.]{0,20}liability|shall not be liable|not (be )?liable)\b/i },
      { label: "Makes you indemnify (defend) them", kind: "bad", delta: -9, re: /\bindemnif(y|ication|ies)\b/i },
      { label: "You use the service at your own risk", kind: "bad", delta: -6, re: /\bat your (own|sole) risk\b/i },
      { label: "Caps damages to a tiny amount", kind: "bad", delta: -6,
        re: /\b(maximum (aggregate )?liability|total liability)[^.]{0,60}(amount you paid|\$\d|limited to)\b/i },
    ],
  },
  {
    id: "billing",
    label: "Billing & cancellation",
    weight: 0.10,
    base: 76,
    signals: [
      { label: "Auto-renews your subscription", kind: "bad", delta: -14, re: /\b(auto(matically)?[- ]?renew|automatic renewal|renews? automatically)\b/i },
      { label: "Non-refundable charges", kind: "bad", delta: -10, re: /\b(non[- ]?refundable|no refunds?)\b/i },
      { label: "Can change prices / fees", kind: "bad", delta: -7, re: /\b((change|modify|adjust)[^.]{0,20}(price|fee|rate)|prices? (may|are subject to) change)\b/i },
      { label: "Authorizes recurring charges to your payment method", kind: "bad", delta: -6,
        re: /\b(authoriz[^.]{0,40}(recurring|automatic)[^.]{0,20}charge|automatically charge)\b/i },
      { label: "Lets you cancel anytime", kind: "good", delta: +10, re: /\bcancel (at any time|any ?time|whenever)\b/i },
    ],
  },
  {
    id: "data",
    label: "Data sharing & communications",
    weight: 0.09,
    base: 78,
    signals: [
      { label: "May hand your data to law enforcement / on legal request", kind: "bad", delta: -7,
        re: /\b(law enforcement|legal (request|process)|government (request|authorities)|subpoena|court order)\b/i },
      { label: "Signs you up for marketing / promotional messages", kind: "bad", delta: -8,
        re: /\b(agree to receive|consent to receive|send you)[^.]{0,40}(marketing|promotional|advertising)[^.]{0,20}(email|message|communication)/i },
      { label: "Broadly may share your information", kind: "bad", delta: -6,
        re: /\bwe may (share|disclose|provide)[^.]{0,40}(your (information|data)|personal)\b/i },
    ],
  },
  {
    id: "obligations",
    label: "What they put on you",
    weight: 0.05,
    base: 82,
    signals: [
      { label: "You're responsible for everything on your account", kind: "bad", delta: -6,
        re: /\b(responsible|liable) for (all|any)[^.]{0,40}(activity|use|content)[^.]{0,30}(your account|under your)\b/i },
      { label: "Bans reverse-engineering / scraping", kind: "bad", delta: -4, re: /\b(reverse[- ]engineer|decompile|scrape|crawl)\b/i },
      { label: "You waive rights you can't get back", kind: "bad", delta: -5, re: /\bwaiv[^.]{0,30}(rights?|claims?)\b/i },
    ],
  },
  {
    id: "jurisdiction",
    label: "Where disputes are decided",
    weight: 0.04,
    base: 82,
    signals: [
      { label: "Forces a specific court / governing law", kind: "bad", delta: -9,
        re: /\b(exclusive jurisdiction|courts located in|governed by the laws of|exclusive venue|submit to the jurisdiction)\b/i },
    ],
  },
];

const RUBRICS = { privacy: PRIVACY_RUBRIC, tos: TOS_RUBRIC };
const TYPE_LABELS = { privacy: "Privacy Policy", tos: "Terms of Service" };
const VAGUE_RE = /\b(may|might|such as|including but not limited to|from time to time|as necessary|where appropriate|reasonable|generally)\b/gi;

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

function snippet(text, index, len) {
  const start = Math.max(0, index - 45);
  const raw = text.slice(start, index + len + 70).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + raw + "…";
}

function count(text, re) { return (text.match(re) || []).length; }

/** Heuristically classify a pasted document as a privacy policy or terms of service.
 * Weights distinctive markers so shared nav/footer boilerplate doesn't decide it. */
export function detectType(text) {
  const tos =
    4 * count(text, /\barbitration\b/gi) +
    3 * count(text, /\bindemnif/gi) +
    3 * count(text, /\blimitation of liability\b/gi) +
    2 * count(text, /\b(these terms|this agreement|terms of (service|use)|user agreement)\b/gi) +
    2 * count(text, /\b(warrant(y|ies)|liable|licen[sc]e to)\b/gi) +
    count(text, /\byou (agree|may not|shall)\b/gi);
  const privacy =
    3 * count(text, /\b(personal (data|information)|data we collect|information we collect)\b/gi) +
    2 * count(text, /\b(we collect|cookies?|tracking technolog)\b/gi) +
    2 * count(text, /\b(opt[- ]?out|gdpr|ccpa|do not sell)\b/gi) +
    count(text, /\byour (data|privacy|personal)\b/gi);
  return tos > privacy ? "tos" : "privacy";
}

function scoreDimension(text, dim) {
  let score = dim.base;
  const findings = [];
  for (const sig of dim.signals) {
    const m = sig.re.exec(text);
    if (m) {
      score += sig.delta;
      findings.push({ dimension: dim.label, label: sig.label, kind: sig.kind, impact: sig.delta, evidence: snippet(text, m.index, m[0].length) });
    }
  }
  return { id: dim.id, label: dim.label, weight: dim.weight, score: clamp(Math.round(score)), findings };
}

export function gradeFor(score) {
  if (score >= 85) return { grade: "A", risk: "Low", blurb: "Respects you" };
  if (score >= 70) return { grade: "B", risk: "Moderate", blurb: "Mostly reasonable" };
  if (score >= 55) return { grade: "C", risk: "Elevated", blurb: "Some concerns" };
  if (score >= 40) return { grade: "D", risk: "High", blurb: "User-hostile" };
  return { grade: "F", risk: "Severe", blurb: "Predatory" };
}

/**
 * Analyze raw fine-print text.
 * @param {string} text
 * @param {"auto"|"privacy"|"tos"} [type]
 */
export function analyze(text, type = "auto") {
  if (!text || text.trim().length < 200) {
    throw new Error("Please paste a fuller document (at least a couple of paragraphs).");
  }
  const documentType = type === "auto" ? detectType(text) : type;
  const rubric = RUBRICS[documentType];

  const dimensions = rubric.map((d) => scoreDimension(text, d));
  const totalWeight = rubric.reduce((s, d) => s + d.weight, 0);
  const score = clamp(Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight));
  const g = gradeFor(score);

  const findings = dimensions.flatMap((d) => d.findings)
    .sort((a, b) => (a.kind === b.kind ? Math.abs(b.impact) - Math.abs(a.impact) : a.kind === "bad" ? -1 : 1));

  const words = (text.match(/\S+/g) || []).length;
  const stats = {
    words,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    vagueTerms: (text.match(VAGUE_RE) || []).length,
    redFlags: findings.filter((f) => f.kind === "bad").length,
    greenFlags: findings.filter((f) => f.kind === "good").length,
  };

  // Confidence gate: a baseline-driven rubric will happily "grade" text where it
  // recognised almost nothing — and a doc with no detected clauses would float to
  // a misleadingly-OK score. So we flag low confidence and let the UI withhold the
  // letter grade until there's enough evidence to stand behind it.
  const MIN_FINDINGS = documentType === "tos" ? 5 : 6;
  const lowConfidence = words < 350 || findings.length < MIN_FINDINGS;

  return { documentType, documentTypeLabel: TYPE_LABELS[documentType], score, ...g, dimensions, findings, stats, lowConfidence };
}
