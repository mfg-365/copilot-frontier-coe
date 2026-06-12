// Fetches recent Copilot-related blog posts from public Microsoft RSS feeds,
// de-duplicates, sorts by date, and writes data/blogs.json.
// Runs weekly via GitHub Actions (and on demand). No npm dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "blogs.json");
const MAX_ITEMS = 30;

const FEEDS = [
  {
    url: "https://www.microsoft.com/en-us/microsoft-365/blog/feed/",
    source: "Microsoft 365 Blog",
    copilotOnly: false, // this blog is broadly AI/Copilot; keep AI + Copilot + agent posts
  },
  {
    url: "https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board?board.id=Microsoft365CopilotBlog",
    source: "Microsoft 365 Copilot Blog (Tech Community)",
    copilotOnly: false, // dedicated Copilot blog board — official articles only
  },
];

function decodeOnce(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// Run twice to resolve double-encoded entities (e.g. &amp;nbsp;).
function decode(s) {
  return decodeOnce(decodeOnce(s));
}

function stripTags(s) {
  return decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1] : "";
}

function allTags(block, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(decode(m[1]).trim());
  return out;
}

function parseItems(xml) {
  const items = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    items.push({
      title: stripTags(tag(b, "title")),
      link: decode(tag(b, "link")).trim(),
      pubDate: decode(tag(b, "pubDate")).trim(),
      description: stripTags(tag(b, "description")).slice(0, 240),
      categories: allTags(b, "category"),
    });
  }
  return items;
}

const COPILOT_RE = /copilot|\bagent(s)?\b|work iq|\bAI\b/i;

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "copilot-frontier-site/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      console.warn(`Feed ${feed.url} -> HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseItems(xml)
      .filter((it) => it.title && it.link)
      // Blog articles only — exclude community discussion/forum/idea threads.
      // Tech Community blog posts use /ba-p/; discussions use /m-p/, /td-p/, /idi-p/.
      .filter((it) => {
        if (/techcommunity\.microsoft\.com/i.test(it.link)) {
          return /\/ba-p\//i.test(it.link) && !/\/(m-p|td-p|idi-p|qa-p)\//i.test(it.link);
        }
        return true; // microsoft.com/blog is already official published content
      })
      .filter((it) => {
        if (feed.copilotOnly === false && /copilot/i.test(feed.url)) return true; // dedicated Copilot feed
        const hay = it.title + " " + it.description + " " + it.categories.join(" ");
        return COPILOT_RE.test(hay);
      })
      .map((it) => ({ ...it, source: feed.source }));
  } catch (e) {
    console.warn(`Feed ${feed.url} failed: ${e.message}`);
    return [];
  }
}

async function main() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  let items = results.flat();

  // de-dup by normalized title
  const seen = new Set();
  items = items.filter((it) => {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  items = items
    .map((it) => ({ ...it, _t: Date.parse(it.pubDate) || 0 }))
    .sort((a, b) => b._t - a._t)
    .slice(0, MAX_ITEMS)
    .map(({ _t, ...rest }) => ({
      ...rest,
      date: rest.pubDate ? new Date(rest.pubDate).toISOString() : null,
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: FEEDS.map((f) => ({ source: f.source, url: f.url })),
    count: items.length,
    items,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${items.length} Copilot blog posts to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
