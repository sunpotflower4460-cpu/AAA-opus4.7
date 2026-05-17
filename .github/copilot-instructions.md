# Copilot / Cloud Agent Instructions — Zanshin / 残心

## Project Identity

This project is called **"Zanshin / 残心"**.

It is a calm, Japanese-inspired iOS-first note-taking app.

The goal is **not** to build a feature-heavy notes app.  
The goal is to make writing feel **quiet, spacious, and intentional**.

---

## Core Principles

- **Protect stillness.** Every change should make the app calmer, not noisier.
- **Respect whitespace.** Whitespace is not empty — it is space for thought.
- **Keep the MVP small.** Build only what is needed for the minimum experience.
- **Avoid unnecessary features.** If a feature wasn't in the MVP spec, don't add it.
- **Make the app beautiful on iPhone.** iPhone-first, always.
- **Use Japanese aesthetics carefully, not excessively.** Motifs carry meaning, not decoration.
- **Do not turn the app into a decorative theme park.** Aim for "quiet modern Japanese", not "traditional theme park".
- **Prioritize writing experience over feature count.** A calm editor beats ten half-baked tools.

---

## Phase Rules

### Phase 1 (Current)

- ✅ Work on README and docs only
- ✅ Establish design, concept, MVP scope, and development rules
- ❌ Do not implement the full app
- ❌ Do not deploy to Cloudflare Pages
- ❌ Do not start MVP implementation

### Phase 2

- ✅ Audit the design from Phase 1
- ✅ Create `docs/audit-phase-2.md`
- ❌ Do not deploy
- ❌ Do not overbuild

### Phase 3

- ✅ Build the MVP (React + TypeScript + Vite + Tailwind)
- ✅ Deploy only **after** MVP is complete, if requested
- ❌ Do not deploy mid-implementation

---

## Coding Direction (for Phase 3 and beyond)

When implementation begins:

- Use **React + TypeScript**
- Keep components **simple and focused**
- **Separate storage logic** into `lib/storage.ts` — never write to localStorage directly in components
- Keep **design tokens centralized** (colors, spacing, fonts)
- Use **responsive iPhone-first layout** with safe-area support
- Prefer **localStorage at MVP stage**, structured for easy migration to IndexedDB
- **Avoid adding libraries unless necessary** — prefer built-in browser APIs

---

## UX Guardrails

Never sacrifice the core experience:

```
Open
  ↓
Write
  ↓
Save quietly
  ↓
Return
  ↓
Read again
```

If a feature makes the app:
- noisier
- heavier
- visually crowded
- harder to focus in

**Do not add it in MVP.**

---

## Design Guardrails

- Use the **golden ratio spacing scale**: `4 / 8 / 13 / 21 / 34 / 55 / 89`
- Use only the **defined color palette** (Washi, Sumi, Gold, Indigo, Vermilion, etc.)
- Use **serif fonts** for headings, **sans-serif** for body input
- Animation must be **slow, soft, and intentional** — no bounces, no sparkles
- Minimum transition duration: **200ms**. Prefer 300–400ms for screen transitions.

---

## What Zanshin Is NOT

- Not a feature showcase
- Not a productivity suite
- Not a Markdown editor
- Not a social app
- Not a Japanese theme park
- Not a clone of Notion, Bear, or Obsidian

---

## Key Documents

| File | Purpose |
|------|---------|
| `docs/concept.md` | The philosophy and world of Zanshin |
| `docs/design-system.md` | Colors, typography, spacing, motifs, animation |
| `docs/mvp-spec.md` | What to build in MVP — and what NOT to build |
| `docs/development-phases.md` | Phase-by-phase roadmap and rules |

---

## When in Doubt

Ask: **"Does this make the app more quiet, or more noisy?"**

If more noisy — stop.  
If more quiet — proceed with care.
