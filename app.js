// CreepScore UI — thin view layer over the pure analyzer engine.
import { analyze } from "./src/analyzer.js";

const $ = (s) => document.querySelector(s);
let docType = "auto";

const GRADE_COLOR = { A: "#10b981", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" };
const barColor = (s) => (s >= 75 ? "#10b981" : s >= 55 ? "#eab308" : s >= 40 ? "#f97316" : "#ef4444");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// --- Sample chips ----------------------------------------------------------
async function loadSamples() {
  try {
    const manifest = await (await fetch("samples/manifest.json")).json();
    $("#chips").innerHTML = manifest
      .map((s, i) => `<button data-i="${i}" title="${esc(s.note)}"
        class="chip px-2.5 py-1 rounded-full text-xs border border-slate-700 hover:border-indigo-500 hover:text-indigo-300 text-slate-300">${esc(s.label)}</button>`)
      .join("");
    $("#chips").querySelectorAll(".chip").forEach((btn) => {
      btn.onclick = async () => {
        const s = manifest[btn.dataset.i];
        const text = await (await fetch("samples/" + s.file)).text();
        $("#input").value = text;
        setType(s.type);
        run();
      };
    });
  } catch {
    $("#chips").innerHTML = `<span class="text-xs text-slate-600">(samples load once deployed)</span>`;
  }
}

// --- Doc-type toggle -------------------------------------------------------
function setType(t) {
  docType = t;
  document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.type === t));
}
document.querySelectorAll(".seg").forEach((b) => (b.onclick = () => setType(b.dataset.type)));

// --- Run analysis ----------------------------------------------------------
function run() {
  const text = $("#input").value;
  $("#error").classList.add("hidden");
  try {
    render(analyze(text, docType));
  } catch (e) {
    $("#results").classList.add("hidden");
    $("#error").textContent = e.message;
    $("#error").classList.remove("hidden");
  }
}
$("#analyze").onclick = run;
$("#clear").onclick = () => { $("#input").value = ""; $("#results").classList.add("hidden"); $("#error").classList.add("hidden"); };

// --- Render ----------------------------------------------------------------
function render(r) {
  const color = GRADE_COLOR[r.grade];
  const bad = r.findings.filter((f) => f.kind === "bad");
  const good = r.findings.filter((f) => f.kind === "good");

  const dims = r.dimensions
    .slice()
    .sort((a, b) => a.score - b.score)
    .map((d) => `
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

  $("#results").innerHTML = `
    <div class="fade grid sm:grid-cols-[auto_1fr] gap-5 items-center bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div class="flex flex-col items-center justify-center rounded-2xl px-7 py-5" style="background:${color}1a;border:1px solid ${color}40">
        <div class="text-6xl font-extrabold leading-none" style="color:${color}">${r.grade}</div>
        <div class="mono text-sm mt-1" style="color:${color}">${r.score}/100</div>
      </div>
      <div>
        <div class="flex items-center gap-2 flex-wrap">
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
    </div>`;
  $("#results").classList.remove("hidden");
  $("#results").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

loadSamples();
