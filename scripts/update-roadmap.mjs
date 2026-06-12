// Fetches the public Microsoft 365 Roadmap, filters for Copilot features that are
// in development or recently rolled out, and writes data/roadmap.json.
// Runs weekly via GitHub Actions (and on demand).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "roadmap.json");
const API = "https://www.microsoft.com/releasecommunications/api/v1/m365";
const MAX_ITEMS = 60;

function monthKey(v) {
  // publicDisclosureAvailabilityDate looks like "July CY2026" or "Q3 CY2026"
  return (v || "").toString();
}

async function main() {
  const res = await fetch(API, { headers: { "User-Agent": "copilot-frontier-site/1.0" } });
  if (!res.ok) throw new Error(`Roadmap API returned ${res.status}`);
  const all = await res.json();

  const isCopilot = (f) => {
    const hay = [
      f.title,
      f.description,
      ...(f.tagsContainer?.products?.map((p) => p.tagName) || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes("copilot");
  };

  const clean = (s) =>
    (s || "")
      .replace(/\u2011/g, "-") // non-breaking hyphen
      .replace(/[\u00a0\u2007\u202f]/g, " ") // non-breaking spaces
      .replace(/\s+/g, " ")
      .trim();

  const items = all
    .filter(isCopilot)
    .filter((f) => ["In development", "Rolling out", "Launched"].includes(f.status))
    .map((f) => ({
      id: f.id,
      title: clean(f.title),
      description: clean(f.description),
      status: f.status,
      products: (f.tagsContainer?.products || []).map((p) => p.tagName),
      platforms: (f.tagsContainer?.platforms || []).map((p) => p.tagName),
      releasePhase: (f.tagsContainer?.releasePhase || []).map((p) => p.tagName),
      availability: monthKey(f.publicDisclosureAvailabilityDate),
      preview: monthKey(f.publicPreviewDate),
      modified: f.modified || f.created || null,
      link: `https://www.microsoft.com/en-us/microsoft-365/roadmap?id=${f.id}`,
    }))
    .sort((a, b) => new Date(b.modified) - new Date(a.modified))
    .slice(0, MAX_ITEMS);

  const byStatus = (s) => items.filter((i) => i.status === s).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "https://www.microsoft.com/en-us/microsoft-365/roadmap?searchterms=Copilot",
    totalCopilotFeatures: all.filter(isCopilot).length,
    counts: {
      inDevelopment: byStatus("In development"),
      rollingOut: byStatus("Rolling out"),
      launched: byStatus("Launched"),
    },
    items,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${items.length} Copilot roadmap items to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
