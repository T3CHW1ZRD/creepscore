// CreepScore UI — thin view layer over the pure analyzer engine.
import { analyze } from "./src/analyzer.js";
import { deepAnalyze } from "./src/semantic.js";

const $ = (s) => document.querySelector(s);
let docType = "auto";
let lastText = "";
let lastResult = null;
let sourceLabel = "Pasted document";

const GRADE_COLOR = { A: "#10b981", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" };
const barColor = (s) => (s >= 75 ? "#10b981" : s >= 55 ? "#eab308" : s >= 40 ? "#f97316" : "#ef4444");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// --- Sample chips (grouped, with active state) -----------------------------
async function loadSamples() {
  try {
    const manifest = await (await fetch("samples/manifest.json")).json();
    const chip = (s, i) => `<button data-i="${i}" title="${esc(s.note)}"
      class="chip px-2.5 py-1 rounded-full text-xs border border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-indigo-200 transition">${esc(s.label)}</button>`;
    $("#chipsPrivacy").innerHTML = manifest.map((s, i) => (s.type === "privacy" ? chip(s, i) : "")).join("");
    $("#chipsTos").innerHTML = manifest.map((s, i) => (s.type === "tos" ? chip(s, i) : "")).join("");

    document.querySelectorAll(".chip").forEach((btn) => {
      btn.onclick = async () => {
        const s = manifest[btn.dataset.i];
        const text = await (await fetch("samples/" + s.file)).text();
        $("#input").value = text;
        setActiveChip(btn);
        setType(s.type);
        sourceLabel = `${s.label}`;
        run();
      };
    });
  } catch {
    $("#chipsPrivacy").innerHTML = `<span class="text-xs text-slate-600">(samples load once deployed)</span>`;
  }
}

function setActiveChip(btn) {
  document.querySelectorAll(".chip").forEach((b) =>
    b.classList.remove("bg-indigo-600", "text-white", "border-indigo-500"));
  if (btn) btn.classList.add("bg-indigo-600", "text-white", "border-indigo-500");
}

// --- Doc-type toggle -------------------------------------------------------
function setType(t) {
  docType = t;
  document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.type === t));
}
document.querySelectorAll(".seg").forEach((b) => (b.onclick = () => setType(b.dataset.type)));

// Typing your own text resets the source + clears the active sample.
$("#input").addEventListener("input", () => { sourceLabel = "Pasted document"; setActiveChip(null); });

// --- Run analysis ----------------------------------------------------------
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
  $("#input").value = ""; sourceLabel = "Pasted document"; setActiveChip(null);
  $("#results").classList.add("hidden"); $("#error").classList.add("hidden");
};

// --- Render ----------------------------------------------------------------
function render(r) {
  const color = GRADE_COLOR[r.grade];
  const bad = r.findings.filter((f) => f.kind === "bad");
  const good = r.findings.filter((f) => f.kind === "good");

  const dims = r.dimensions.slice().sort((a, b) => a.score - b.score).map((d) => `
      <div class="mb-2.5">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-300">${esc(d.label)}</span>
          <span class="mono" style="color:${barColor(d.score)}">${d.score}</span>
        </div>
        <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div class="bar h-full rounded-full" style="width:${d.score}%;background:${barColor(d.score)}"></div>
        </div>
      </div>`).join("");

  const findingCard = (f) => `
    <div class="border ${f.kind === "bad" ? "border-rose-500/30 bg-rose-500/5" : "border-emerald-500/30 bg-emerald-500/5"} rounded-xl p-3">
      <div class="flex items-start gap-2">
        <span>${f.kind === "bad" ? "🚩" : "✅"}</span>
        <div class="min-w-0">
          <div class="text-sm font-medium ${f.kind === "bad" ? "text-rose-200" : "text-emerald-200"}">${esc(f.label)}
            <span class="mono text-[10px] ${f.kind === "bad" ? "text-rose-400" : "text-emerald-400"}">${f.impact > 0 ? "+" : ""}${f.impact}</span>
          </div>
          <div class="text-[11px] text-slate-500 mb-1">${esc(f.dimension)}</div>
          <div class="mono text-[11px] text-slate-400 leading-relaxed">${esc(f.evidence)}</div>
        </div>
      </div>
    </div>`;

  const lowConfBanner = r.lowConfidence ? `
    <div class="fade bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm rounded-xl p-3 mb-5">
      ⚠️ <b>Low confidence.</b> Only ${r.findings.length} recognizable clause(s) detected (${r.stats.words.toLocaleString()} words).
      This looks like an incomplete paste or an unusual document — treat the grade below as provisional.
    </div>` : "";

  $("#results").innerHTML = `
    ${lowConfBanner}
    <div class="fade grid sm:grid-cols-[auto_1fr] gap-5 items-center bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div class="flex flex-col items-center justify-center rounded-2xl px-7 py-5" style="background:${color}1a;border:1px solid ${color}40">
        <div class="text-6xl font-extrabold leading-none" style="color:${color}">${r.grade}</div>
        <div class="mono text-sm mt-1" style="color:${color}">${r.score}/100</div>
      </div>
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-semibold text-white bg-slate-800 rounded-full px-3 py-0.5">${esc(sourceLabel)}</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${esc(r.documentTypeLabel)}</span>
          <span class="text-xs px-2 py-0.5 rounded-full" style="background:${color}1a;color:${color}">${r.risk} risk</span>
        </div>
        <h2 class="text-2xl font-bold mt-2">${esc(r.blurb)}</h2>
        <div class="flex gap-4 text-xs text-slate-400 mt-3 flex-wrap">
          <span>🚩 <b class="text-rose-300">${r.stats.redFlags}</b> red flags</span>
          <span>✅ <b class="text-emerald-300">${r.stats.greenFlags}</b> good signs</span>
          <span>📖 ${r.stats.readingMinutes} min read · ${r.stats.words.toLocaleString()} words</span>
          <span>🌫️ ${r.stats.vagueTerms} vague terms</span>
        </div>
      </div>
    </div>

    <div class="fade grid md:grid-cols-2 gap-5 mt-5">
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
        <h3 class="font-semibold mb-3 text-slate-200">Category breakdown</h3>
        ${dims}
      </div>
      <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
        <h3 class="font-semibold mb-3 text-slate-200">What it actually says</h3>
        <div class="space-y-2.5">
          ${bad.length ? bad.map(findingCard).join("") : '<p class="text-sm text-slate-500">No major red flags found.</p>'}
          ${good.map(findingCard).join("")}
        </div>
      </div>
    </div>

    <div id="deep" class="fade bg-slate-900/70 border border-slate-800 rounded-2xl p-5 mt-5">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 class="font-semibold text-slate-200">🧠 Deep semantic analysis <span class="text-xs text-slate-500">(optional · in-browser AI)</span></h3>
          <p class="text-xs text-slate-500 mt-0.5">Catches paraphrased clauses the rules miss. A small model runs locally — your text never leaves the page.</p>
        </div>
        <button id="deepBtn" class="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-sm font-semibold shrink-0">Run deep analysis</button>
      </div>
      <div id="deepStatus" class="text-xs text-slate-400 mt-3 hidden"></div>
      <div id="deepOut" class="mt-3 space-y-2.5"></div>
    </div>`;

  $("#results").classList.remove("hidden");
  $("#deepBtn").onclick = runDeep;
  $("#results").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --- Deep (semantic) analysis ----------------------------------------------
async function runDeep() {
  const btn = $("#deepBtn"), status = $("#deepStatus"), out = $("#deepOut");
  btn.disabled = true; btn.textContent = "Working…";
  status.classList.remove("hidden");
  status.textContent = "Loading model (~25 MB, one-time)…";
  try {
    const { findings, sentenceCount } = await deepAnalyze(lastText, lastResult.documentType, (p) => {
      if (p && p.status === "progress" && p.file) status.textContent = `Downloading model: ${p.file} … ${Math.round(p.progress || 0)}%`;
      else if (p && p.status === "ready") status.textContent = "Embedding sentences locally…";
    });
    status.textContent = `Scanned ${sentenceCount} sentences in your browser · ${findings.length} semantic match(es). These may overlap the rule findings.`;
    out.innerHTML = findings.length
      ? findings.map(deepCard).join("")
      : '<p class="text-sm text-slate-500">No additional clauses detected semantically.</p>';
    btn.textContent = "Re-run"; btn.disabled = false;
  } catch (e) {
    status.textContent = "Deep analysis failed: " + e.message + " — needs internet the first time to fetch the model.";
    btn.textContent = "Retry"; btn.disabled = false;
  }
}

function deepCard(f) {
  const isBad = f.kind === "bad";
  return `
    <div class="border ${isBad ? "border-rose-500/30 bg-rose-500/5" : "border-emerald-500/30 bg-emerald-500/5"} rounded-xl p-3">
      <div class="flex items-start gap-2">
        <span>${isBad ? "🚩" : "✅"}</span>
        <div class="min-w-0 w-full">
          <div class="flex justify-between gap-2">
            <span class="text-sm font-medium ${isBad ? "text-rose-200" : "text-emerald-200"}">${esc(f.label)}</span>
            <span class="mono text-[10px] text-fuchsia-300 shrink-0">${f.similarity}% match</span>
          </div>
          <div class="text-[11px] text-slate-500 mb-1">${esc(f.dimension)} · semantic</div>
          <div class="mono text-[11px] text-slate-400 leading-relaxed">“${esc(f.evidence)}”</div>
        </div>
      </div>
    </div>`;
}

loadSamples();
