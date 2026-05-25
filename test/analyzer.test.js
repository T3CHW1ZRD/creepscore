// Behavioural tests for the CreepScore engine, run against real fetched
// privacy policies and terms of service. Run with `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyze, detectType, gradeFor, PRIVACY_RUBRIC, TOS_RUBRIC } from "../src/analyzer.js";

const samples = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");
const load = (n) => readFileSync(join(samples, n), "utf8");

test("detectType classifies unambiguous documents", () => {
  assert.equal(detectType(load("google.txt")), "privacy");
  assert.equal(detectType(load("discord_tos.txt")), "tos");
  assert.equal(detectType(load("github_tos.txt")), "tos");
  assert.equal(detectType(load("spotify_tos.txt")), "tos");
});

test("analyze returns a well-formed result", () => {
  const r = analyze(load("google.txt"), "privacy");
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.match(r.grade, /^[ABCDF]$/);
  assert.equal(r.dimensions.length, PRIVACY_RUBRIC.length);
  assert.ok(Array.isArray(r.findings) && r.findings.length > 0);
  assert.equal(r.documentType, "privacy");
  for (const d of r.dimensions) assert.ok(d.score >= 0 && d.score <= 100);
});

test("auto-detect drives the right rubric", () => {
  assert.equal(analyze(load("discord_tos.txt"), "auto").dimensions.length, TOS_RUBRIC.length);
  assert.equal(analyze(load("google.txt"), "auto").dimensions.length, PRIVACY_RUBRIC.length);
});

test("privacy-respecting services outscore data-hungry ones", () => {
  const score = (n) => analyze(load(n), "privacy").score;
  assert.ok(score("duckduckgo.txt") > score("google.txt"), "DuckDuckGo should beat Google");
  assert.ok(score("duckduckgo.txt") > score("tiktok.txt"), "DuckDuckGo should beat TikTok");
  assert.ok(score("signal.txt") > score("google.txt"), "Signal should beat Google");
});

test("ToS without forced arbitration scores better on dispute rights", () => {
  const disputes = (n) => analyze(load(n), "tos").dimensions.find((d) => d.id === "disputes").score;
  assert.ok(disputes("github_tos.txt") > disputes("discord_tos.txt"), "GitHub (no arbitration) > Discord");
});

test("forced-arbitration ToS surfaces an arbitration red flag", () => {
  const r = analyze(load("discord_tos.txt"), "tos");
  assert.ok(r.findings.some((f) => f.kind === "bad" && /arbitration/i.test(f.label)));
});

test("synthetic extremes land at the right ends of the scale", () => {
  const awful =
    "We collect your precise location, biometric data, browsing history, and contacts. " +
    "We may sell your personal information to third parties and advertising partners and data brokers. " +
    "We use targeted advertising and track you across sites and build a profile about you. " +
    "We retain data as long as necessary.";
  const great =
    "We do not collect or store any personal data. Your messages are protected with end-to-end encryption. " +
    "We do not sell your data and we never share your information. We do not track you and use no cookies. " +
    "You have the right to delete your data and may opt out at any time.";
  assert.ok(["D", "F"].includes(analyze(awful, "privacy").grade), "awful policy should be D/F");
  assert.ok(["A", "B"].includes(analyze(great, "privacy").grade), "great policy should be A/B");
});

test("gradeFor boundaries", () => {
  assert.equal(gradeFor(90).grade, "A");
  assert.equal(gradeFor(72).grade, "B");
  assert.equal(gradeFor(60).grade, "C");
  assert.equal(gradeFor(45).grade, "D");
  assert.equal(gradeFor(20).grade, "F");
});

test("rejects too-short input", () => {
  assert.throws(() => analyze("too short", "privacy"));
});

test("flags low confidence when little is recognized, not when it's a real doc", () => {
  const sparse = "Welcome to our wonderful service. We hope you enjoy using it. ".repeat(8);
  assert.equal(analyze(sparse, "privacy").lowConfidence, true);
  assert.equal(analyze(load("google.txt"), "privacy").lowConfidence, false);
  assert.equal(analyze(load("discord_tos.txt"), "tos").lowConfidence, false);
});
