// ----- Tab switching -----
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function activate(id) {
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === id));
  panels.forEach((p) => p.classList.toggle("is-active", p.id === id));
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "updates") loadRoadmap();
}

tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));
document.querySelectorAll("[data-jump]").forEach((b) =>
  b.addEventListener("click", () => activate(b.dataset.jump))
);

// Open the tab from the URL hash on load
const initial = (location.hash || "#overview").slice(1);
if (document.getElementById(initial)) activate(initial);

// ----- Deck links (optional, configured separately) -----
// To enable, set window.DECK_LINKS in assets/js/decks.config.js, e.g.:
//   window.DECK_LINKS = { intro: "https://...", business: "https://..." }
(function wireDecks() {
  const links = window.DECK_LINKS || {};
  const note = document.getElementById("decksNote");
  const cards = document.querySelectorAll(".deck-card");
  let enabled = 0;
  cards.forEach((card) => {
    const url = links[card.dataset.deck];
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "deck-card enabled";
      a.innerHTML = card.innerHTML;
      card.replaceWith(a);
      enabled++;
    }
  });
  if (note) {
    note.textContent = enabled
      ? "Click a deck to open it."
      : "Deck links are not yet configured — add internal (e.g., SharePoint) URLs in assets/js/decks.config.js to make these clickable.";
  }
})();

// ----- Roadmap (Copilot Updates) -----
let roadmapData = null;
let activeStatus = "all";

function statusClass(s) {
  return s === "In development" ? "s-dev" : s === "Rolling out" ? "s-roll" : "s-launch";
}
function esc(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function renderRoadmap() {
  const list = document.getElementById("roadmapList");
  if (!roadmapData) return;
  const q = (document.getElementById("roadmapSearch").value || "").toLowerCase().trim();
  const items = roadmapData.items.filter((i) => {
    const okStatus = activeStatus === "all" || i.status === activeStatus;
    const okQ = !q || (i.title + " " + i.description).toLowerCase().includes(q);
    return okStatus && okQ;
  });

  if (!items.length) {
    list.innerHTML = '<div class="rm-empty">No matching features. Try a different search or filter.</div>';
    return;
  }

  list.innerHTML = items
    .map((i) => {
      const title = i.title.replace(/^Microsoft Copilot \(Microsoft 365\):\s*/i, "");
      const meta = [];
      if (i.availability) meta.push(`<span class="m">GA: ${esc(i.availability)}</span>`);
      if (i.preview) meta.push(`<span class="m">Preview: ${esc(i.preview)}</span>`);
      (i.platforms || []).slice(0, 4).forEach((p) => meta.push(`<span class="m">${esc(p)}</span>`));
      return `<article class="rm-card" data-s="${esc(i.status)}">
        <div class="rm-head">
          <h3 class="rm-title"><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(title)}</a></h3>
          <span class="rm-status ${statusClass(i.status)}">${esc(i.status)}</span>
        </div>
        <p class="rm-desc">${esc(i.description)}</p>
        <div class="rm-meta">${meta.join("")}</div>
      </article>`;
    })
    .join("");
}

async function loadRoadmap() {
  if (roadmapData) return; // load once
  const list = document.getElementById("roadmapList");
  list.innerHTML = '<div class="rm-empty">Loading the latest Copilot roadmap&hellip;</div>';
  try {
    const res = await fetch("data/roadmap.json", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    roadmapData = await res.json();
  } catch (e) {
    list.innerHTML = '<div class="rm-empty">Could not load roadmap data. Please check back shortly.</div>';
    return;
  }

  // meta
  const c = roadmapData.counts || {};
  document.getElementById("metaCounts").innerHTML =
    `<span class="count-badge"><i class="dot-dev"></i>${c.inDevelopment || 0} in development</span>` +
    `<span class="count-badge"><i class="dot-roll"></i>${c.rollingOut || 0} rolling out</span>` +
    `<span class="count-badge"><i class="dot-launch"></i>${c.launched || 0} launched</span>`;
  const d = roadmapData.generatedAt ? new Date(roadmapData.generatedAt) : null;
  document.getElementById("metaUpdated").textContent = d
    ? "Last updated " + d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";

  renderRoadmap();
}

document.getElementById("roadmapSearch").addEventListener("input", renderRoadmap);
document.querySelectorAll("#statusFilter .chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    document.querySelectorAll("#statusFilter .chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeStatus = chip.dataset.status;
    renderRoadmap();
  })
);
