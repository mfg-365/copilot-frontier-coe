// ----- Tab switching -----
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function activate(id) {
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === id));
  panels.forEach((p) => p.classList.toggle("is-active", p.id === id));
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (id === "updates") loadRoadmap();
  if (id === "blogs") loadBlogs();
  if (id === "newsletter") loadNewsletter();
}

tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));
document.querySelectorAll("[data-jump]").forEach((b) =>
  b.addEventListener("click", () => activate(b.dataset.jump))
);

// Deck links are wired below; the initial tab is activated at the end of the file.

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

// ----- Driver cards (convert to real links to their deep-dive decks) -----
(function wireDrivers() {
  const links = window.DECK_LINKS || {};
  document.querySelectorAll(".driver-card").forEach((card) => {
    const url = links[card.dataset.deck];
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = card.className + " clickable";
    a.innerHTML = card.innerHTML + '<span class="card-open">Open deck \u2192</span>';
    card.replaceWith(a);
  });
})();

// ----- Champions deck CTA on the Champion Teams page -----
(function wireChampionsCta() {
  const links = window.DECK_LINKS || {};
  const cta = document.getElementById("championsDeckCta");
  const link = document.getElementById("championsDeckLink");
  if (!cta || !link) return;
  if (links.champions) {
    link.href = links.champions;
  } else {
    cta.style.display = "none";
  }
})();
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

// ----- Blogs (Copilot Blogs) -----
let blogData = null;

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderBlogs() {
  const list = document.getElementById("blogList");
  if (!blogData) return;
  const q = (document.getElementById("blogSearch").value || "").toLowerCase().trim();
  const items = blogData.items.filter(
    (i) => !q || (i.title + " " + i.description).toLowerCase().includes(q)
  );
  if (!items.length) {
    list.innerHTML = '<div class="rm-empty">No matching posts. Try a different search.</div>';
    return;
  }
  list.innerHTML = items
    .map((i) => {
      const meta = [];
      if (i.date) meta.push(`<span class="m">${esc(fmtDate(i.date))}</span>`);
      if (i.source) meta.push(`<span class="m">${esc(i.source)}</span>`);
      return `<article class="rm-card blog-card">
        <div class="rm-head">
          <h3 class="rm-title"><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a></h3>
        </div>
        ${i.description ? `<p class="rm-desc">${esc(i.description)}&hellip;</p>` : ""}
        <div class="rm-meta">${meta.join("")}</div>
      </article>`;
    })
    .join("");
}

async function loadBlogs() {
  if (blogData) return;
  const list = document.getElementById("blogList");
  list.innerHTML = '<div class="rm-empty">Loading the latest Copilot blog posts&hellip;</div>';
  try {
    const res = await fetch("data/blogs.json", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    blogData = await res.json();
  } catch (e) {
    list.innerHTML = '<div class="rm-empty">Could not load blog data. Please check back shortly.</div>';
    return;
  }
  document.getElementById("blogMeta").innerHTML =
    `<span class="count-badge"><i class="dot-launch"></i>${blogData.count || 0} recent posts</span>`;
  const d = blogData.generatedAt ? new Date(blogData.generatedAt) : null;
  document.getElementById("blogUpdated").textContent = d
    ? "Last updated " + d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";
  renderBlogs();
}

document.getElementById("blogSearch").addEventListener("input", renderBlogs);

// ----- Newsletter (Champion Newsletter) -----
let newsletterData = null;

function renderNewsletter() {
  const list = document.getElementById("newsletterList");
  if (!newsletterData) return;
  const eds = newsletterData.editions || [];
  if (!eds.length) {
    list.innerHTML = '<div class="rm-empty">No editions yet. Check back soon.</div>';
    return;
  }
  list.innerHTML = eds
    .map((ed, idx) => {
      const reads = (ed.reads || [])
        .map((r) => `<li><a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.title)}</a></li>`)
        .join("");
      const roadmap = ed.roadmap
        ? `<div class="nl-block"><span class="nl-label">On the roadmap</span>
             <p class="nl-h">${esc(ed.roadmap.title)} <span class="nl-pill">${esc(ed.roadmap.status)}</span></p>
             <p class="nl-text">${esc(ed.roadmap.description)}</p>
             <a class="nl-link" href="${esc(ed.roadmap.link)}" target="_blank" rel="noopener">See details &rarr;</a></div>`
        : "";
      return `<article class="nl-card" data-idx="${idx}">
        <div class="nl-head">
          <div>
            <span class="nl-edition">Champion Weekly</span>
            <h3 class="nl-date">${esc(ed.dateLabel)} &middot; ${esc(ed.id)}</h3>
          </div>
          <button class="copy-btn" data-copy="${idx}">Copy post</button>
        </div>
        <div class="nl-block">
          <span class="nl-label">Prompt of the week</span>
          <p class="nl-h">${esc(ed.prompt.title)}</p>
          <p class="nl-quote">${esc(ed.prompt.text)}</p>
        </div>
        <div class="nl-block">
          <span class="nl-label">Copilot in ${esc(ed.tip.app)}</span>
          <p class="nl-text">${esc(ed.tip.tip)}</p>
        </div>
        <div class="nl-block">
          <span class="nl-label">Frontier spotlight</span>
          <p class="nl-h">${esc(ed.capability.name)}</p>
          <p class="nl-text">${esc(ed.capability.text)}</p>
          <a class="nl-link" href="${esc(ed.capability.link)}" target="_blank" rel="noopener">Learn more &rarr;</a>
        </div>
        ${roadmap}
        ${reads ? `<div class="nl-block"><span class="nl-label">Worth a read</span><ul class="nl-reads">${reads}</ul></div>` : ""}
      </article>`;
    })
    .join("");

  list.querySelectorAll(".copy-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ed = eds[+btn.dataset.copy];
      try {
        await navigator.clipboard.writeText(ed.copyText);
        const orig = btn.textContent;
        btn.textContent = "Copied \u2713";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 1800);
      } catch {
        // Fallback: select a hidden textarea
        const ta = document.createElement("textarea");
        ta.value = ed.copyText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        btn.textContent = "Copied \u2713";
        setTimeout(() => (btn.textContent = "Copy post"), 1800);
      }
    })
  );
}

async function loadNewsletter() {
  if (newsletterData) return;
  const list = document.getElementById("newsletterList");
  list.innerHTML = '<div class="rm-empty">Loading the latest editions&hellip;</div>';
  try {
    const res = await fetch("data/newsletters.json", { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    newsletterData = await res.json();
  } catch (e) {
    list.innerHTML = '<div class="rm-empty">Could not load newsletter data. Please check back shortly.</div>';
    return;
  }
  document.getElementById("nlMeta").innerHTML =
    `<span class="count-badge"><i class="dot-launch"></i>${newsletterData.count || 0} editions</span>`;
  const d = newsletterData.generatedAt ? new Date(newsletterData.generatedAt) : null;
  document.getElementById("nlUpdated").textContent = d
    ? "Last updated " + d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";
  renderNewsletter();
}

// Open the tab from the URL hash on load (after all state + handlers are defined)
const initial = (location.hash || "#overview").slice(1);
if (document.getElementById(initial)) activate(initial);
