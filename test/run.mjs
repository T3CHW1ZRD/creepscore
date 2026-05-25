// Eval printer: grade every bundled real-world sample so we can sanity-check
// and tune the rubric. Run with `npm run eval`.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyze } from "../src/analyzer.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");
const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();

console.log("name".padEnd(16), "type".padEnd(8), "grade", "score", " dimensions");
console.log("-".repeat(90));
for (const f of files) {
  const text = readFileSync(join(dir, f), "utf8");
  const r = analyze(text, "auto");
  const dims = r.dimensions.map((d) => `${d.id}:${d.score}`).join(" ");
  console.log(
    f.replace(".txt", "").padEnd(16),
    r.documentType.padEnd(8),
    ` ${r.grade}  `,
    String(r.score).padStart(3),
    `  🚩${r.stats.redFlags} ✅${r.stats.greenFlags}  ${dims}`
  );
}
