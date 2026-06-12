// Assembles a weekly "Champion Newsletter" edition with copy-and-paste posts.
// Combines a rotating library of advanced prompts + Copilot-in-apps tips +
// Frontier capabilities with the latest roadmap/blog data. Accumulates one
// edition per ISO week into data/newsletters.json (newest first).
// Runs weekly via GitHub Actions (and on demand). No npm dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");
const OUT = path.join(DATA, "newsletters.json");
const MAX_EDITIONS = 24;

// ---------- Rotating content libraries ----------
const PROMPTS = [
  { title: "Turn a meeting into an action plan", text: "Based on the transcript and chat from my last meeting with [team], list every decision made, every open question, and a table of action items with owners and due dates. Then draft a short follow-up email I can send to attendees." },
  { title: "Executive-ready summary", text: "Summarize this document for a busy executive in 5 bullet points, then add a one-line 'so what' that explains the business impact. Flag anything that needs a decision from me." },
  { title: "Compare and recommend", text: "Compare these [proposals/vendors/options] across cost, risk, time-to-value, and effort in a table. Recommend one and explain the trade-offs in two sentences." },
  { title: "Prep me for a 1:1", text: "Using our recent emails, chats, and shared files, prepare me for my 1:1 with [name]. Summarize what we last agreed, what's outstanding, and suggest three thoughtful questions to ask." },
  { title: "Draft, then sharpen", text: "Draft a [proposal/update/announcement] about [topic] for [audience]. Keep it under 200 words, confident and concrete. Then give me an alternate version that's more concise and one that's more persuasive." },
  { title: "Find the signal in my inbox", text: "Review my unread email from the past week and group it into 'Needs my reply', 'FYI', and 'Can wait'. For the first group, draft a one-line suggested reply for each." },
  { title: "Build a project tracker", text: "From these notes, create a project plan: phases, key milestones with target dates, risks with mitigations, and a RACI for the core team. Output it as a table I can paste into a doc." },
  { title: "Catch me up", text: "I've been out for [N] days. Catch me up on [project/channel]: what changed, what decisions were made, what needs my attention, and anything I was @mentioned in." },
  { title: "Stress-test my thinking", text: "Act as a skeptical reviewer. Here is my plan for [topic]. Identify the three weakest assumptions, what could go wrong, and what evidence would change your mind." },
  { title: "Role-based onboarding", text: "Create a 30-day onboarding checklist for a new [role] on my team, including who they should meet, what systems they need, and three quick wins for their first two weeks." },
  { title: "Data to narrative", text: "Look at this spreadsheet and tell me the three most important trends. Explain what's driving each one and suggest a chart that would communicate it best to leadership." },
  { title: "Rewrite for clarity", text: "Rewrite this so a non-expert can understand it. Remove jargon, shorten sentences, and lead with the most important point. Keep the meaning exact." },
];

const APP_TIPS = [
  { app: "Word", tip: "Ask Copilot to 'draft a [document type] from these bullet points', then 'add a section on [topic]' and 'rewrite the intro to be more concise'. Reference an existing file with the / command to ground it in your own content." },
  { app: "Excel", tip: "Select your data and ask Copilot to 'highlight the top trends', 'add a column that calculates [metric]', or 'create a PivotTable summarizing sales by region'. It explains the formulas it writes so you can learn as you go." },
  { app: "PowerPoint", tip: "Turn a Word doc into a deck: 'create a presentation from this document'. Then refine with 'add a slide summarizing the budget' or 'make this slide more visual'. Use 'summarize this presentation' to brief yourself fast." },
  { app: "Outlook", tip: "Try 'summarize this email thread', 'draft a reply that politely declines', or 'turn this email into a meeting agenda'. Coaching tips can also score your draft for tone, clarity, and reader sentiment before you send." },
  { app: "Teams", tip: "During or after a meeting, ask Copilot to 'recap the key points', 'list action items and owners', or 'what was decided about [topic]?'. Catch up on long chats with 'summarize what I missed'." },
  { app: "Copilot Chat", tip: "Use the work grounding to ask cross-app questions: 'What are the latest updates on [project] from my emails, chats, and files?' Then turn the answer into a Copilot Page to collaborate on it." },
  { app: "Loop / Pages", tip: "Promote a great Copilot answer into a Copilot Page, then @mention teammates to co-edit. It's the fastest way to turn an AI draft into shared, living team content." },
  { app: "OneNote", tip: "Ask Copilot to 'summarize my notes from this section', 'turn these notes into a to-do list', or 'draft a plan based on this brainstorm' to convert messy notes into structured next steps." },
];

const CAPABILITIES = [
  { name: "Copilot Cowork", text: "Describe the outcome you want and Cowork plans the steps and takes action across your files and conversations — completing long-running, multi-step work. Now supports plugins and mobile.", link: "https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-features" },
  { name: "Copilot Notebooks", text: "Pull Teams meetings, Outlook emails, and web content in as sources, then generate richer outputs like Excel worksheets and infographics directly from your notebook.", link: "https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-features" },
  { name: "Microsoft Scout", text: "An AI desktop app that stays connected to your priorities, monitors what matters, and moves work forward across the Microsoft 365 apps you use every day.", link: "https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-features" },
  { name: "Agentic Copilot in Outlook", text: "Copilot can carry out multi-step inbox and calendar tasks over time — triaging email, organizing messages, and resolving meeting conflicts.", link: "https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-features" },
  { name: "Researcher", text: "A reasoning agent that runs deeper, multi-step research across your work and the web to produce thorough, cited answers for complex questions.", link: "https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-program" },
  { name: "Finance Agent", text: "Gives finance teams and stakeholders a centralized, role-aware view of financial performance with up-to-date, permission-aware insights.", link: "https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-features" },
];

// ---------- ISO week helpers ----------
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}
function weekIndex(year, week) {
  return year * 53 + week;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch {
    return fallback;
  }
}

function buildCopyText(ed) {
  const lines = [];
  lines.push(`MICROSOFT 365 COPILOT — CHAMPION WEEKLY (${ed.dateLabel})`);
  lines.push("");
  lines.push(`PROMPT OF THE WEEK — ${ed.prompt.title}`);
  lines.push(`"${ed.prompt.text}"`);
  lines.push("");
  lines.push(`COPILOT IN ${ed.tip.app.toUpperCase()}`);
  lines.push(ed.tip.tip);
  lines.push("");
  lines.push(`FRONTIER SPOTLIGHT — ${ed.capability.name}`);
  lines.push(ed.capability.text);
  lines.push(`Learn more: ${ed.capability.link}`);
  if (ed.roadmap) {
    lines.push("");
    lines.push(`ON THE ROADMAP — ${ed.roadmap.title} (${ed.roadmap.status})`);
    lines.push(ed.roadmap.description);
    lines.push(`Details: ${ed.roadmap.link}`);
  }
  if (ed.reads && ed.reads.length) {
    lines.push("");
    lines.push("WORTH A READ");
    ed.reads.forEach((r) => lines.push(`- ${r.title} — ${r.link}`));
  }
  lines.push("");
  lines.push("Questions? Reach your Copilot Champion. Built for guidance only; references public Microsoft sources.");
  return lines.join("\n");
}

function makeEdition(year, week) {
  const idx = weekIndex(year, week);
  const roadmap = readJson("roadmap.json", { items: [] });
  const blogs = readJson("blogs.json", { items: [] });

  const prompt = PROMPTS[idx % PROMPTS.length];
  const tip = APP_TIPS[idx % APP_TIPS.length];
  const capability = CAPABILITIES[idx % CAPABILITIES.length];

  const devItems = (roadmap.items || []).filter((i) => i.status === "In development");
  const rmPool = devItems.length ? devItems : roadmap.items || [];
  const rm = rmPool.length ? rmPool[idx % rmPool.length] : null;
  const roadmapPick = rm
    ? {
        title: rm.title.replace(/^Microsoft Copilot \(Microsoft 365\):\s*/i, ""),
        status: rm.status,
        description: rm.description,
        link: rm.link,
      }
    : null;

  const reads = (blogs.items || []).slice(0, 2).map((b) => ({ title: b.title, link: b.link }));

  // Approximate the Monday of this ISO week for a friendly date label.
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dateLabel = simple.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  const ed = {
    id: `${year}-W${String(week).padStart(2, "0")}`,
    year,
    week,
    dateLabel,
    prompt,
    tip,
    capability,
    roadmap: roadmapPick,
    reads,
  };
  ed.copyText = buildCopyText(ed);
  return ed;
}

function main() {
  const existing = readJson("newsletters.json", { editions: [] });
  let editions = existing.editions || [];

  const now = new Date();

  // Ensure the current week plus the previous few weeks each have an edition
  // (newest first). This backfills history on first run and self-heals gaps.
  const WEEKS_TO_ENSURE = 4;
  for (let back = 0; back < WEEKS_TO_ENSURE; back++) {
    const d = new Date(now.getTime() - back * 7 * 86400000);
    const { year, week } = isoWeek(d);
    const id = `${year}-W${String(week).padStart(2, "0")}`;
    const i = editions.findIndex((e) => e.id === id);
    const fresh = makeEdition(year, week);
    if (i === -1) editions.push(fresh);
    else editions[i] = fresh; // refresh in place (roadmap/blogs may have changed)
  }

  // Sort newest-first by week index and cap the history.
  editions.sort((a, b) => weekIndex(b.year, b.week) - weekIndex(a.year, a.week));
  const trimmed = editions.slice(0, MAX_EDITIONS);

  const payload = { generatedAt: now.toISOString(), count: trimmed.length, editions: trimmed };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${trimmed.length} newsletter edition(s); current = ${trimmed[0] && trimmed[0].id}`);
}

main();
