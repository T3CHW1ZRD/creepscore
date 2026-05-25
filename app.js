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

const GRADE_COLOR = { A: "#16a34a", B: "#65a30d", C: "#d4a017", D: "#ea580c", F: "#ef4444" };
const barColor = (s) => (s >= 75 ? "#16a34a" : s >= 55 ? "#d4a017" : s >= 40 ? "#ea580c" : "#ef4444");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const logo = (domain) =>
  `https://unavatar.io/${encodeURIComponent(domain)}" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}'`;

// --- Theme -----------------------------------------------------------------
const themeBtn = $("#themeToggle");
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("cs-theme", t);
  themeBtn.textContent = t === "dark" ? "🌙" : "☀️";
}
applyTheme(localStorage.getItem("cs-theme") || "dark");
themeBtn.onclick = () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");

// --- Company library -------------------------------------------------------
async function loadLibrary() {
  try { MANIFEST = await (await fetch("samples/manifest.json")).json(); } catch { return; }
  $("#count").textContent = MANIFEST.length;
  const tile = (s, i) => `
    <button class="company rounded-xl p-2.5 flex items-center gap-2.5 text-left" data-i="${i}" data-label="${esc(s.label.toLowerCase())}">
      <span class="logo grid place-items-center w-9 h-9 rounded-lg shrink-0"><img loading="lazy" alt="" src="${logo(s.domain)}"></span>
      <span class="text-sm font-medium truncate">${esc(s.label)}</span>
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

$$(".tab").forEach((t) => (t.onclick = () => {
  $$(".tab").forEach((x) => x.classList.remove("active"));
  t.classList.add("active");
  const tos = t.dataset.tab === "tos";
  $("#gridTos").classList.toggle("hidden", !tos);
  $("#gridPrivacy").classList.toggle("hidden", tos);
}));

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
function flag(f) {
  const meta = (f.impact != null ? (f.impact > 0 ? "+" : "") + f.impact : "") + (f.similarity ? f.similarity + "%" : "");
  return `
    <details class="flag ${f.kind === "bad" ? "flag-bad" : "flag-good"}">
      <summary>
        <span class="chev mono text-xs">▸</span>
        <span class="ttl text-sm font-medium flex-1 min-w-0">${esc(f.label)}</span>
        <span class="mono text-[10px] muted shrink-0">${meta}</span>
      </summary>
      <div class="evidence">
        <div class="text-[11px] muted mb-1">${esc(f.dimension)}</div>
        <div class="mono text-[11px] leading-relaxed" style="opacity:.8">“${esc(f.evidence)}”</div>
      </div>
    </details>`;
}

function render(r) {
  const color = GRADE_COLOR[r.grade];
  const bad = r.findings.filter((f) => f.kind === "bad");
  const good = r.findings.filter((f) => f.kind === "good");

  const dims = r.dimensions.slice().sort((a, b) => a.score - b.score).map((d) => `
    <div class="mb-3">
      <div class="flex justify-between text-xs mb-1.5"><span class="muted">${esc(d.label)}</span>
        <span class="mono font-medium" style="color:${barColor(d.score)}">${d.score}</span></div>
      <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--bg2)">
        <div class="bar h-full rounded-full" style="width:${d.score}%;background:${barColor(d.score)}"></div></div>
    </div>`).join("");

  const lowConf = r.lowConfidence ? `
    <div class="fade rounded-xl p-3 mb-5 text-sm" style="background:var(--bad-bg);border:1px solid var(--bad-bd);color:var(--bad-tx)">
      <b>Low confidence.</b> Only ${r.findings.length} recognizable clause(s) in ${r.stats.words.toLocaleString()} words — likely an incomplete paste. Treat this grade as provisional.
    </div>` : "";

  const srcLogo = source.domain
    ? `<span class="logo grid place-items-center w-11 h-11 rounded-lg border bdr shrink-0"><img alt="" src="${logo(source.domain)}" style="width:26px;height:26px"></span>`
    : `<span class="grid place-items-center w-11 h-11 rounded-lg shrink-0 muted" style="background:var(--bg2)">¶</span>`;

  $("#results").innerHTML = `
    ${lowConf}
    <div class="fade card p-6 flex items-center gap-6 flex-wrap">
      <div class="grid place-items-center w-24 h-24 rounded-2xl shrink-0" style="background:${color}1f;border:1px solid ${color}55">
        <div class="display text-5xl font-bold leading-none" style="color:${color}">${r.grade}</div>
        <div class="mono text-xs mt-1" style="color:${color}">${r.score}/100</div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-3">
          ${srcLogo}
          <div><div class="display text-xl font-semibold leading-tight">${esc(source.label)}</div>
            <div class="text-xs muted">${esc(r.documentTypeLabel)} · <span style="color:${color}">${r.risk} risk</span></div></div>
        </div>
        <p class="muted mt-3 text-sm">${esc(r.blurb)} — ${r.stats.redFlags} red flag(s), ${r.stats.greenFlags} good sign(s).</p>
        <div class="flex gap-2 mt-3 text-xs muted flex-wrap">
          <span class="rounded-full px-2.5 py-1 border bdr">📖 ${r.stats.readingMinutes} min read</span>
          <span class="rounded-full px-2.5 py-1 border bdr">${r.stats.words.toLocaleString()} words</span>
          <span class="rounded-full px-2.5 py-1 border bdr">${r.stats.vagueTerms} vague terms</span>
        </div>
      </div>
    </div>

    <div class="fade grid md:grid-cols-2 gap-5 mt-5">
      <div class="card p-5"><h3 class="display font-semibold mb-4">Category breakdown</h3>${dims}</div>
      <div class="card p-5">
        <h3 class="display font-semibold mb-1">What it actually says</h3>
        <p class="text-xs muted mb-3">Click any item to read the exact clause.</p>
        <div class="space-y-2">
          ${bad.length ? bad.map(flag).join("") : '<p class="text-sm muted">No major red flags found.</p>'}
          ${good.map(flag).join("")}
        </div>
      </div>
    </div>

    <div id="deep" class="fade card p-5 mt-5">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div><h3 class="display font-semibold">Deep semantic analysis <span class="text-xs font-normal muted">· optional, in-browser AI</span></h3>
          <p class="text-xs muted mt-0.5">Catches paraphrased clauses the rules miss. Runs locally — your text never leaves the page.</p></div>
        <button id="deepBtn" class="px-4 py-2 rounded-lg text-sm font-semibold shrink-0 border" style="border-color:var(--accent);color:var(--accent)">Run deep analysis</button>
      </div>
      <div id="deepStatus" class="text-xs muted mt-3 hidden"></div>
      <div id="deepOut" class="mt-3 grid sm:grid-cols-2 gap-2"></div>
    </div>`;

  $("#results").classList.remove("hidden");
  $("#deepBtn").onclick = runDeep;
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Deep analysis ---------------------------------------------------------
async function runDeep() {
  const btn = $("#deepBtn"), status = $("#deepStatus"), out = $("#deepOut");
  btn.disabled = true; btn.textContent = "Working…"; btn.style.opacity = ".6";
  status.classList.remove("hidden");
  status.textContent = "Loading model (~25 MB, one-time)…";
  try {
    const { findings, sentenceCount } = await deepAnalyze(lastText, lastResult.documentType, (p) => {
      if (p && p.status === "progress" && p.file) status.textContent = `Downloading model: ${p.file} … ${Math.round(p.progress || 0)}%`;
    });
    status.textContent = `Scanned ${sentenceCount} sentences in your browser · ${findings.length} semantic match(es) (may overlap the rules).`;
    out.innerHTML = findings.length ? findings.map(flag).join("") : '<p class="text-sm muted">No additional clauses detected semantically.</p>';
    btn.textContent = "Re-run"; btn.disabled = false; btn.style.opacity = "1";
  } catch (e) {
    status.textContent = "Deep analysis failed: " + e.message + " — needs internet the first time to fetch the model.";
    btn.textContent = "Retry"; btn.disabled = false; btn.style.opacity = "1";
  }
}

loadLibrary();
