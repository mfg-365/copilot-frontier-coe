# Frontier Center of Excellence & Microsoft 365 Copilot Champion Teams

An interactive, tabbed website covering how to build a **Frontier Center of Excellence**
and an internal **Microsoft 365 Copilot Champion network** — including why 2–3 champions
per line of business matter, the benefits of the Frontier program, and a **Copilot
roadmap feed that refreshes weekly**.

Built as a static site for **GitHub Pages**. Microsoft Copilot branded.

## Sections
- **Overview** – the case for scaling AI with structure
- **Frontier CoE** – five drivers of AI value & four scaling motions
- **Champion Teams** – the champion model and why 2–3 per line of business
- **Frontier Program** – early-access value and recent Frontier features
- **Copilot Updates** – live feed from the public Microsoft 365 Roadmap (auto-updated weekly)
- **Resources** – official Microsoft links and source decks

## Sources
- [Frontier Program](https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-program)
- [Frontier Features](https://www.microsoft.com/en-us/microsoft-365-copilot/frontier-features)
- [Copilot Adoption Hub](https://adoption.microsoft.com/en-us/copilot/)
- [Microsoft 365 Roadmap (Copilot)](https://www.microsoft.com/en-us/microsoft-365/roadmap?searchterms=Copilot)

## Weekly updates
`.github/workflows/update-roadmap.yml` runs every Monday (and on demand). It executes
`scripts/update-roadmap.mjs`, which pulls the public Microsoft 365 Roadmap API, filters for
Copilot features that are in development, rolling out, or recently launched, and writes
`data/roadmap.json`. Any change is committed automatically, which rebuilds the Pages site.

To run it locally:

```bash
node scripts/update-roadmap.mjs
```

## Enabling the deck links
The Frontier CoE decks are **internal Microsoft enablement assets** and are intentionally
**not hosted on this public site**. To make the deck cards on the Resources tab clickable,
add internal (e.g., SharePoint) URLs in [`assets/js/decks.config.js`](assets/js/decks.config.js).

## Local preview
Any static server works, e.g.:

```bash
npx serve .
```

---
Microsoft, Microsoft 365, and Copilot are trademarks of the Microsoft group of companies.
Content references public Microsoft sources and is for informational purposes only.
