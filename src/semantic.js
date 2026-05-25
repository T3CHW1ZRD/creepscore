// Optional "deep analysis" — semantic clause detection that runs ENTIRELY in
// the browser via transformers.js (no token, no server, data never leaves the
// page). It embeds every sentence of the policy with a small sentence model and
// flags clauses that *mean* the same as a curated set of risky prototypes — so
// it catches paraphrased red flags the literal regex rules miss.
//
// The model (MiniLM, ~25MB) is fetched from the HuggingFace CDN on first use.
// Pure helpers below are unit-tested in Node; the model load is browser-only.

const TRANSFORMERS_CDN = "https://esm.sh/@xenova/transformers@2.17.2";
const MODEL = "Xenova/all-MiniLM-L6-v2";

/** Curated "risky clause" prototypes, per document type. */
export const PROTOTYPES = {
  privacy: [
    { kind: "bad", category: "Sharing & selling", text: "We sell your personal information to third parties." },
    { kind: "bad", category: "Sharing & selling", text: "We share your data with advertising and marketing partners." },
    { kind: "bad", category: "Sharing & selling", text: "We disclose your information to our affiliates and business partners." },
    { kind: "bad", category: "Collection", text: "We collect your precise geolocation and device location." },
    { kind: "bad", category: "Collection", text: "We collect biometric and sensitive personal data." },
    { kind: "bad", category: "Tracking", text: "We track your activity across other websites and apps." },
    { kind: "bad", category: "Tracking", text: "We use your data to show you personalized targeted advertising." },
    { kind: "bad", category: "Retention", text: "We may retain your personal data indefinitely." },
    { kind: "good", category: "Sharing & selling", text: "We do not sell your personal information." },
    { kind: "good", category: "Security", text: "Your data is protected with end-to-end encryption." },
    { kind: "good", category: "Your rights", text: "You can request deletion of your personal data at any time." },
  ],
  tos: [
    { kind: "bad", category: "Disputes", text: "Any disputes must be resolved through binding arbitration." },
    { kind: "bad", category: "Disputes", text: "You waive your right to participate in a class action lawsuit." },
    { kind: "bad", category: "Disputes", text: "You waive your right to a trial by jury." },
    { kind: "bad", category: "Your content", text: "You grant us a perpetual, worldwide, royalty-free license to your content." },
    { kind: "bad", category: "Changes", text: "We may modify or change these terms at any time without notice." },
    { kind: "bad", category: "Termination", text: "We may suspend or terminate your account at any time for any reason." },
    { kind: "bad", category: "Billing", text: "Your subscription will automatically renew and charges are non-refundable." },
    { kind: "good", category: "Your content", text: "You retain full ownership of the content you create." },
    { kind: "good", category: "Disputes", text: "You may opt out of the arbitration agreement." },
  ],
};

/** Split prose into reasonably-sized candidate sentences. */
export function splitSentences(text, { min = 40, max = 320, cap = 140 } = {}) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+(?=[A-Z(0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= min && s.length <= max)
    .slice(0, cap);
}

/** Cosine similarity of two equal-length vectors. */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}

/**
 * For each prototype, find the best-matching sentence above `threshold`.
 * Returns findings deduped by sentence (keeping the strongest match).
 */
export function matchPrototypes(sentEmb, sentences, protoEmb, protos, threshold = 0.45) {
  const best = new Map(); // sentence -> finding
  protos.forEach((proto, pi) => {
    let topI = -1, topSim = threshold;
    for (let si = 0; si < sentences.length; si++) {
      const sim = cosine(sentEmb[si], protoEmb[pi]);
      if (sim > topSim) { topSim = sim; topI = si; }
    }
    if (topI >= 0) {
      const ev = sentences[topI];
      const finding = { label: proto.text, kind: proto.kind, dimension: proto.category, similarity: Math.round(topSim * 100), evidence: ev, match: ev };
      const existing = best.get(ev);
      if (!existing || finding.similarity > existing.similarity) best.set(ev, finding);
    }
  });
  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
}

// --- Browser-only model loading -------------------------------------------
let _extractor = null;

export async function loadModel(onProgress) {
  if (_extractor) return _extractor;
  const { pipeline, env } = await import(TRANSFORMERS_CDN);
  env.allowLocalModels = false; // always fetch from the HF CDN
  _extractor = await pipeline("feature-extraction", MODEL, { progress_callback: onProgress, quantized: true });
  return _extractor;
}

// Embed in small chunks, yielding to the event loop between each so the page
// repaints (live progress counter) instead of freezing on one giant blocking call.
async function embed(texts, onTick) {
  const CHUNK = 12;
  const vecs = [];
  for (let i = 0; i < texts.length; i += CHUNK) {
    const out = await _extractor(texts.slice(i, i + CHUNK), { pooling: "mean", normalize: true });
    vecs.push(...out.tolist());
    if (onTick) onTick(Math.min(i + CHUNK, texts.length), texts.length);
    await new Promise((r) => setTimeout(r, 0)); // let the UI repaint
  }
  return vecs;
}

/** Run the full semantic pass (browser only). `onProgress` receives load + embed events. */
export async function deepAnalyze(text, documentType = "privacy", onProgress) {
  await loadModel(onProgress);
  const sentences = splitSentences(text);
  if (!sentences.length) return { findings: [], sentenceCount: 0 };
  const protos = PROTOTYPES[documentType] || PROTOTYPES.privacy;
  const protoEmb = await embed(protos.map((p) => p.text));
  const sentEmb = await embed(sentences, (done, total) => onProgress && onProgress({ status: "embedding", done, total }));
  return { findings: matchPrototypes(sentEmb, sentences, protoEmb, protos), sentenceCount: sentences.length };
}
