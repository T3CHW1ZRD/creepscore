# CreepScore 🔍

**A transparent report card for the fine print — privacy policies and terms of service.**

Nobody reads the privacy policy. CreepScore does it for you: paste a privacy policy or terms of service and get an instant **A–F grade**, a category breakdown, and the *exact clauses* that earned it — the data they sell, the trackers they run, the arbitration clause that quietly waives your right to sue.

### 🔗 Live: https://t3chw1zrd.github.io/creepscore/

![grade](https://img.shields.io/badge/runs-100%25_in_your_browser-10b981) ![noai](https://img.shields.io/badge/no-AI_black_box-4f46e5) ![tests](https://img.shields.io/badge/tests-10_passing-success)

---

## Why it's different

Every other "AI legal tool" pipes your document to a server and an opaque LLM. For a **privacy** tool, that's the joke writing itself. CreepScore is the opposite:

- **100% client-side** — your document never leaves your browser. There is no backend. (That's not a limitation — for a privacy/security tool, it's the entire point.)
- **No AI black box** — scoring is a **transparent, auditable rubric**. Every point traces to a specific matched clause, shown to you as evidence. You can read exactly *why* it got a D.
- **Two rubrics, auto-detected** — privacy policies and terms of service hide different things, so they're graded differently.

## What it catches

**Privacy Policy** → what they do with your data: selling, third-party sharing, data brokers, collection breadth (location, biometrics, contacts, browsing), tracking & targeted ads, your rights (GDPR/CCPA, delete, opt-out), retention, encryption.

**Terms of Service** → how they can hurt you legally: **forced arbitration**, **class-action waivers**, **broad content/IP licenses**, **unilateral term changes**, **terminate-at-will**, liability disclaimers, **auto-renewal / non-refundable** billing, forced jurisdiction.

## Tested on real companies

Grades produced by the engine against the **actual live policies** (bundled in `samples/`):

| Service | Type | Grade |
|---|---|:--:|
| Signal | Privacy | **B (75)** |
| DuckDuckGo | Privacy | **B (75)** |
| Proton | Privacy | **C (69)** |
| TikTok | Privacy | **C (56)** |
| Google | Privacy | **D (53)** |
| Apple | Privacy | **D (45)** |
| GitHub | Terms of Service | **C (64)** |
| Discord | Terms of Service | **C (57)** — forced arbitration flagged |
| Spotify | Terms of Service | **C (57)** — arbitration + auto-renew |

Privacy-first services rise to the top; ad-driven giants sink — exactly as you'd expect.

## How the score works

Each rubric has weighted **dimensions** (e.g. "Third-party sharing" is 25% of the privacy score). Each dimension starts at a baseline and every matched clause nudges it up or down, clamped to 0–100. The overall score is the weighted average, mapped to a letter grade. It's all in [`src/analyzer.js`](src/analyzer.js) — readable and tweakable.

## Run locally

```bash
# any static server works — there is no backend
python -m http.server 8080
# open http://localhost:8080
```

## Test

```bash
npm test     # 10 behavioural tests against the real bundled policies
npm run eval # print grades for every sample
```

## Tech

Vanilla JS (ES modules) · Tailwind · zero build step · zero dependencies · zero network. The analyzer is a pure function reused identically by the browser UI and the Node test suite.

Built for **HackNomics 2026** — *Cybersecurity & Privacy*.

## License

MIT © Amr Alomari
