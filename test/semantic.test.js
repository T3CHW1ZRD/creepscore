// Tests for the pure (non-model) parts of the semantic layer. The MiniLM model
// load is browser-only and not exercised here.
import test from "node:test";
import assert from "node:assert/strict";
import { splitSentences, cosine, matchPrototypes, PROTOTYPES } from "../src/semantic.js";

test("splitSentences segments and filters by length", () => {
  const text = "We collect your data. " + "x ".repeat(50) + "We sell it to advertisers and partners across the world. Short.";
  const out = splitSentences(text, { min: 20, max: 320, cap: 50 });
  assert.ok(out.length >= 1);
  assert.ok(out.every((s) => s.length >= 20 && s.length <= 320));
  assert.ok(!out.includes("Short."));
});

test("cosine similarity basics", () => {
  assert.equal(cosine([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosine([1, 1], [1, 0]) - Math.SQRT1_2) < 1e-9);
});

test("matchPrototypes flags the closest sentence above threshold", () => {
  const sentences = ["unrelated boilerplate text", "we sell personal information to third parties"];
  const sentEmb = [[0, 1], [1, 0]];
  const protos = [{ text: "we sell your data", kind: "bad", category: "Sharing" }];
  const protoEmb = [[1, 0]];
  const findings = matchPrototypes(sentEmb, sentences, protoEmb, protos, 0.45);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence, "we sell personal information to third parties");
  assert.equal(findings[0].kind, "bad");
  assert.equal(findings[0].similarity, 100);
});

test("matchPrototypes returns nothing when all below threshold", () => {
  const findings = matchPrototypes([[0, 1]], ["x"], [[1, 0]], [{ text: "p", kind: "bad", category: "c" }], 0.45);
  assert.equal(findings.length, 0);
});

test("prototype sets exist for both document types", () => {
  assert.ok(PROTOTYPES.privacy.length > 3 && PROTOTYPES.tos.length > 3);
  for (const p of [...PROTOTYPES.privacy, ...PROTOTYPES.tos]) {
    assert.match(p.kind, /^(bad|good)$/);
    assert.ok(p.text && p.category);
  }
});
