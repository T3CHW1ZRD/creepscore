// CreepScore UI — view layer over the pure analyzer + semantic engines.
import { analyze } from "./src/analyzer.js";
import { deepAnalyze } from "./src/semantic.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let docType = "auto";
let lastText = "";
let lastResult = null;
let source = { label: "Pasted document", domain: null };
let MANIFEST = [];

const GRADE_COLOR = { A: "#16a34a", B: "#65a30d", C: "#ca8a04", D: "#ea580c", F: "#dc2626" };
const barColor = (s) => (s >= 75 ? "#16a34a" : s >= 55 ? "#ca8a04" : s >= 40 ? "#ea580c" : "#dc2626");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const logo = (domain) =>
  `https://unavatar.io/${encodeURIComponent(domain)}" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}'`;

// --- Company library -------------------------------------------------------
async function loadLibrary() {
  try {
    MANIFEST = await (await fetch("samples/manifest.json")).json();
  } catch { return; }
  $("#count").textContent = MANIFEST.length;
  const tile = (s, i) => `
    <button class="company bg-white border border-[#ececf0] rounded-xl p-3 flex items-center gap-2.5 text-left" data-i="${i}" data-label="${esc(s.label.toLowerCase())}">
      <img loading="lazy" alt="" src="${logo(s.domain)}">
      <span class="text-sm font-medium text-slate-700 truncate">${esc(s.label)}</span>
    </button>`;
  $("#gridPrivacy").innerHTML = MANIFEST.map((s, i) => (s.type === "privacy" ? tile(s, i) : "")).join("");
  $("#gridTos").innerHTML = MANIFEST.map((s, i) => (s.type === "tos" ? tile(s, i) : "")).join("");

  $$(".company").forEach((btn) => {
    btn.onclick = async () => {
      const s = MANIFEST[btn.dataset.i];
      const text = await (await fetch("samples/" + s.file)).text();
      $("#input").value = text;
      $$(".company").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setType(s.type);
      source = { label: s.label, domain: s.domain };
      run();
    };
  });
}

// Tabs (Privacy / Terms)
$$(".tab").forEach((t) => (t.onclick = () => {
  $$(".tab").forEach((x) => x.classList.remove("active"));
  t.classList.add("active");
  const tos = t.dataset.tab === "tos";
  $("#gridTos").classList.toggle("hidden", !tos);
  $("#gridPrivacy").classList.toggle("hidden", tos);
}));

// Search filter
$("#search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  $$(".company").forEach((b) => b.classList.toggle("hidden", !b.dataset.label.includes(q)));
});

// --- Doc-type toggle -------------------------------------------------------
function setType(t) {
  docType = t;
  $$(".seg").forEach((b) => b.classList.toggle("active", b.dataset.type === t));
}
$$(".seg").forEach((b) => (b.onclick = () => setType(b.dataset.type)));
$("#input").addEventListener("input", () => {
  source = { label: "Pasted document", domain: null };
  $$(".company").forEach((b) => b.classList.remove("active"));
});

// --- Run -------------------------------------------------------------------
function run() {
  $("#error").classList.add("hidden");
  try {
    lastText = $("#input").value;
    lastResult = analyze(lastText, docType);
    render(lastResult);
  } catch (e) {
    $("#results").classList.add("hidden");
    $("#error").textContent = e.message;
    $("#error").classList.remove("hidden");
  }
}
$("#analyze").onclick = run;
$("#clear").onclick = () => {
  $("#input").value = ""; source = { label: "Pasted document", domain: null };
  $$(".company").forEach((b) => b.classList.remove("active"));
  $("#results").classList.add("hidden"); $("#error").classList.add("hidden");
};

// --- Render ----------------------------------------------------------------
function render(r) {
  const color = GRADE_COLOR[r.grade];
  const bad = r.findings.filter((f) => f.kind === "bad");
  const good = r.findings.filter((f) => f.kind === "good");

  const dims = r.dimensions.slice().sort((a, b) => a.score - b.score).map((d) => `
    <div class="mb-3">
      <div class="flex justify-between text-xs mb-1.5">
        <span class="text-slate-600">${esc(d.label)}</span>
        <span class="mono font-medium" style="color:${barColor(d.score)}">${d.score}</span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div class="bar h-full rounded-full" style="width:${d.score}%;background:${barColor(d.score)}"></div>
      </div>
    </div>`).join("");

  const card = (f) => `
    <div class="border ${f.kind === "bad" ? "border-rose-100 bg-rose-50/60" : "border-emerald-100 bg-emerald-50/60"} rounded-xl p-3">
      <div class="flex items-start justify-between gap-2">
        <span class="text-sm font-medium ${f.kind === "bad" ? "text-rose-800" : "text-emerald-800"}">${esc(f.label)}</span>
        <span class="mono text-[10px] mt-0.5 shrink-0 ${f.kind === "bad" ? "text-rose-400" : "text-emerald-500"}">${f.impact > 0 ? "+" : ""}${f.impact ?? ""}${f.similarity ? f.similarity + "%" : ""}</span>
      </div>
      <div class="text-[11px] text-slate-400 mt-0.5 mb-1.5">${esc(f.dimension)}</div>
      <div class="mono text-[11px] text-slate-500 leading-relaxed">${esc(f.evidence)}</div>
    </div>`;

  const lowConf = r.lowConfidence ? `
    <div class="fade rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3 mb-5">
      <b>Low confidence.</b> Only ${r.findings.length} recognizable clause(s) in ${r.stats.words.toLocaleString()} words — likely an incomplete paste. Treat this grade as provisional.
    </div>` : "";

  const srcLogo = source.domain
    ? `<img class="w-10 h-10 rounded-lg border border-[#ececf0]" alt="" src="${logo(source.domain)}">`
    : `<div class="w-10 h-10 rounded-lg bg-slate-100 grid place-items-center text-slate-400">¶</div>`;

  $("#results").innerHTML = `
    ${lowConf}
    <div class="fade card p-6 shadow-sm flex items-center gap-6 flex-wrap">
      <div class="grid place-items-center w-24 h-24 rounded-2xl shrink-0" style="background:${color}14;border:1px solid ${color}33">
        <div class="display text-5xl font-bold leading-none" style="color:${color}">${r.grade}</div>
        <div class="mono text-xs mt-1" style="color:${color}">${r.score}/100</div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-3">
          ${srcLogo}
          <div>
            <div class="display text-xl font-semibold leading-tight">${esc(source.label)}</div>
            <div class="text-xs text-slate-500">${esc(r.documentTypeLabel)} · <span style="color:${color}">${r.risk} risk</span></div>
          </div>
        </div>
        <p class="text-slate-600 mt-3 text-sm">${esc(r.blurb)} — based on ${r.stats.redFlags} red flag(s) and ${r.stats.greenFlags} good sign(s).</p>
        <div class="flex gap-2 mt-3 text-xs text-slate-500 flex-wrap">
          <span class="bg-slate-50 border border-[#ececf0] rounded-full px-2.5 py-1">📕 ${r.stats.readingMinutes} min read</span>
          <span class="bg-slate-50 border border-[#ececf0] rounded-full px-2.5 py-1">${r.stats.words.toLocaleString()} words</span>
          <span class="bg-slate-50 border border-[#ececf0] rounded-full px-2.5 py-1">${r.stats.vagueTerms} vague terms</span>
        </div>
      </div>
    </div>

    <div class="fade grid md:grid-cols-2 gap-5 mt-5">
      <div class="card p-5">
        <h3 class="display font-semibold mb-4">Category breakdown</h3>
        ${dims}
      </div>
      <div class="card p-5">
        <h3 class="display font-semibold mb-4">What it actually says</h3>
        <div class="space-y-2.5">
          ${bad.length ? bad.map(card).join("") : '<p class="text-sm text-slate-400">No major red flags found.</p>'}
          ${good.map(card).join("")}
        </div>
      </div>
    </div>

    <div id="deep" class="fade card p-5 mt-5">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 class="display font-semibold">Deep semantic analysis <span class="text-xs font-normal text-slate-400">· optional, in-browser AI</span></h3>
          <p class="text-xs text-slate-500 mt-0.5">Catches paraphrased clauses the rules miss. A small model runs locally — your text never leaves the page.</p>
        </div>
        <button id="deepBtn" class="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-semibold shrink-0">Run deep analysis</button>
      </div>
      <div id="deepStatus" class="text-xs text-slate-500 mt-3 hidden"></div>
      <div id="deepOut" class="mt-3 grid sm:grid-cols-2 gap-2.5"></div>
    </div>`;

  $("#results").classList.remove("hidden");
  $("#deepBtn").onclick = runDeep;
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Deep analysis ---------------------------------------------------------
async function runDeep() {
  const btn = $("#deepBtn"), status = $("#deepStatus"), out = $("#deepOut");
  btn.disabled = true; btn.textContent = "Working…"; btn.classList.add("opacity-60");
  status.classList.remove("hidden");
  status.textContent = "Loading model (~25 MB, one-time)…";
  try {
    const { findings, sentenceCount } = await deepAnalyze(lastText, lastResult.documentType, (p) => {
      if (p && p.status === "progress" && p.file) status.textContent = `Downloading model: ${p.file} … ${Math.round(p.progress || 0)}%`;
    });
    status.textContent = `Scanned ${sentenceCount} sentences in your browser · ${findings.length} semantic match(es) (may overlap the rule findings).`;
    out.innerHTML = findings.length
      ? findings.map((f) => `
        <div class="border ${f.kind === "bad" ? "border-rose-100 bg-rose-50/60" : "border-emerald-100 bg-emerald-50/60"} rounded-xl p-3">
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm font-medium ${f.kind === "bad" ? "text-rose-800" : "text-emerald-800"}">${esc(f.label)}</span>
            <span class="mono text-[10px] text-indigo-500 shrink-0">${f.similarity}%</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5 mb-1.5">${esc(f.dimension)} · semantic</div>
          <div class="mono text-[11px] text-slate-500 leading-relaxed">“${esc(f.evidence)}”</div>
        </div>`).join("")
      : '<p class="text-sm text-slate-400">No additional clauses detected semantically.</p>';
    btn.textContent = "Re-run"; btn.disabled = false; btn.classList.remove("opacity-60");
  } catch (e) {
    status.textContent = "Deep analysis failed: " + e.message + " — needs internet the first time to fetch the model.";
    btn.textContent = "Retry"; btn.disabled = false; btn.classList.remove("opacity-60");
  }
}

loadLibrary();
