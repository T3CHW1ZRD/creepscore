// CreepScore UI — view-based flow over the pure analyzer + semantic engines.
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
const logo = (d) =>
  `https://unavatar.io/${encodeURIComponent(d)}" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(d)}'`;

// --- Views (no autoscroll; instant reset to top on switch) -----------------
function showView(name) {
  ["pick", "paste", "result"].forEach((v) => $("#" + v + "View").classList.toggle("hidden", v !== name));
  window.scrollTo(0, 0);
}
$("#home").onclick = () => showView("pick");
$("#openPaste").onclick = () => showView("paste");
$("#backFromPaste").onclick = () => showView("pick");
$("#backFromResult").onclick = () => showView("pick");

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
      btn.style.opacity = ".5";
      const text = await (await fetch("samples/" + s.file)).text();
      btn.style.opacity = "1";
      $("#input").value = text;
      setType(s.type);
      source = { label: s.label, domain: s.domain };
      if (run()) showView("result");
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

// --- Suggest a company (no-op acknowledgment) ------------------------------
$("#suggestForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#suggestInput").value.trim();
  if (!v) return;
  $("#suggestMsg").textContent = `Thanks — noted "${v}".`;
  $("#suggestInput").value = "";
});

// --- Doc-type toggle + paste -----------------------------------------------
function setType(t) { docType = t; $$(".seg").forEach((b) => b.classList.toggle("active", b.dataset.type === t)); }
$$(".seg").forEach((b) => (b.onclick = () => setType(b.dataset.type)));
$("#input").addEventListener("input", () => { source = { label: "Pasted document", domain: null }; });

function run() {
  $("#error").classList.add("hidden");
  try {
    lastText = $("#input").value;
    lastResult = analyze(lastText, docType);
    render(lastResult);
    return true;
  } catch (e) {
    $("#error").textContent = e.message;
    $("#error").classList.remove("hidden");
    return false;
  }
}
$("#analyze").onclick = () => { if (run()) showView("result"); };
$("#clear").onclick = () => { $("#input").value = ""; source = { label: "Pasted document", domain: null }; $("#error").classList.add("hidden"); };

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
        <div class="mono text-[11px] leading-relaxed" style="opacity:.85">“${esc(f.evidence)}”</div>
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
    <div class="rounded-xl p-3 mb-4 text-sm" style="background:var(--bad-bg);border:1px solid var(--bad-bd);color:var(--bad-tx)">
      <b>Low confidence.</b> Only ${r.findings.length} recognizable clause(s) in ${r.stats.words.toLocaleString()} words — likely an incomplete paste. Provisional grade.
    </div>` : "";

  const srcLogo = source.domain
    ? `<span class="logo grid place-items-center w-14 h-14 rounded-xl border bdr shrink-0"><img alt="" src="${logo(source.domain)}" style="width:32px;height:32px"></span>`
    : `<span class="grid place-items-center w-14 h-14 rounded-xl shrink-0 muted text-2xl" style="background:var(--bg2)">¶</span>`;

  $("#results").innerHTML = `
    ${lowConf}
    <div class="fade card p-6 sm:p-7">
      <div class="flex items-center gap-5">
        ${srcLogo}
        <div class="flex-1 min-w-0">
          <div class="display text-2xl font-semibold leading-tight truncate">${esc(source.label)}</div>
          <div class="text-sm muted mt-0.5">${esc(r.documentTypeLabel)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="display text-6xl font-bold leading-none" style="color:${color}">${r.grade}</div>
          <div class="mono text-xs muted mt-1">${r.score}/100 · <span style="color:${color}">${r.risk}</span></div>
        </div>
      </div>
      <p class="mt-4 text-[15px]" style="color:var(--text)">${esc(r.blurb)}.
        <span class="muted">${r.stats.redFlags} red flag(s), ${r.stats.greenFlags} good sign(s) · ${r.stats.readingMinutes} min read · ${r.stats.words.toLocaleString()} words.</span></p>
    </div>

    <div class="fade grid md:grid-cols-2 gap-4 mt-4">
      <div class="card p-5 sm:p-6"><h3 class="display font-semibold mb-4">Category breakdown</h3>${dims}</div>
      <div class="card p-5 sm:p-6">
        <h3 class="display font-semibold">What it actually says</h3>
        <p class="text-xs muted mb-3 mt-0.5">Click a clause to read the exact wording.</p>
        <div class="space-y-2">
          ${bad.length ? bad.map(flag).join("") : '<p class="text-sm muted">No major red flags found.</p>'}
          ${good.map(flag).join("")}
        </div>
      </div>
    </div>

    <div class="fade card p-5 sm:p-6 mt-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div><h3 class="display font-semibold">Deep semantic analysis <span class="text-xs font-normal muted">· optional, in-browser AI</span></h3>
          <p class="text-xs muted mt-0.5">Catches paraphrased clauses the rules miss. Runs locally — your text never leaves the page.</p></div>
        <button id="deepBtn" class="px-4 py-2 rounded-lg text-sm font-semibold shrink-0 border" style="border-color:var(--accent);color:var(--accent)">Run deep analysis</button>
      </div>
      <div id="deepStatus" class="text-xs muted mt-3 hidden"></div>
      <div id="deepOut" class="mt-3 grid sm:grid-cols-2 gap-2"></div>
    </div>`;

  $("#deepBtn").onclick = runDeep;
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
