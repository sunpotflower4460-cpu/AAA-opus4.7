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

### Current state and store-polish work

Phase 42 and store-polish PR #51 are on main. Preserve the implementation and the verification limits recorded in `docs/store-release-polish/ACCEPTANCE.md`; its W1 contracts remain the data-safety baseline.

The next approved design handoff is Japanese/English support in `docs/multilingual/README.md`. Read its `BASELINE.md`, `DESIGN.md`, `COPY_AND_RELEASE.md`, `IMPLEMENTATION.md`, and `ACCEPTANCE.md` before that work. Follow I0–I5 and record ML01–ML44 separately from the earlier R01–R37 evidence. The multilingual documents were added as design, not as completed product implementation. Compare the latest code with the recorded baseline; do not revert the title textarea, card display, recovery review, fonts, or Japanese native declarations to old audit code.

For the bilingual release, horizontal reading is required. Keep UI language separate from Note.locale, user text, writing mode, text direction, regional formatting, and time zone. Language changes must preserve drafts, save versions, recovery candidates, protected raw data, and Undo deadlines. The in-memory rescue mechanism does not guarantee unsaved drafts survive a process restart.

The Phase 1–3 rules below describe those historical stages; Phase 1 is no longer the current stage. Follow the user's actual task authorization. The store-polish documents do not grant deployment, store submission, or permission to bypass branch protection or data-safety checks.

The initial release remains free, ad-free, and without Premium, login, or cloud sync. Keep the hard prohibitions below. Retain the existing journal, conflict checks, recovery candidates, and native durability protections.

### Phase 1 (Historical)

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
- Use **serif fonts** for headings and the current 18px writing surface as the comparison baseline; use **sans-serif** for practical UI text. Confirm readability against the current store-polish design instead of reverting to older typography by default.
- Animation must be **slow, soft, and intentional** — no bounces, no sparkles
- Decorative transitions should remain soft; 300–400ms is a reference for screen transitions. Input, save failures, and navigation must not wait for an animation. Respect reduced-motion preferences.

---

## What Zanshin Is NOT

- Not a feature showcase
- Not a productivity suite
- Not a Markdown editor
- Not a social app
- Not a Japanese theme park
- Not a clone of Notion, Bear, or Obsidian

---

## Hard Prohibitions (Do NOT add without explicit user request)

The following must **never** be added by an AI agent on its own initiative, in any phase. They are out of scope for the MVP and changing that scope is a human decision.

- ❌ **AI features** (summarization, autocompletion, suggestions, chat, embeddings, etc.)
- ❌ **Login / authentication / accounts**
- ❌ **Cloud sync / backend / database services**
- ❌ **Paid plans / billing / subscriptions / in-app purchases**
- ❌ **Analytics / telemetry / tracking / external scripts**
- ❌ **Push notifications / reminders**
- ❌ **Social features** (sharing, comments, following, collaboration)
- ❌ **Full Markdown rendering / WYSIWYG editors**
- ❌ **Complex tag systems** (search covers this in MVP)
- ❌ **Cloudflare Pages deployment before the MVP is complete**

If you believe one of these is needed, **stop and ask the user first.** Do not introduce it silently.

---

## Key Documents

| File | Purpose |
|------|---------|
| `docs/multilingual/README.md` | Japanese/English design handoff and current work entry point |
| `docs/multilingual/IMPLEMENTATION.md` | I0–I5 instructions, current-code integration and data invariants |
| `docs/multilingual/ACCEPTANCE.md` | ML01–ML44 status, checks and evidence |
| `docs/store-release-polish/README.md` | Current store-polish scope and document entry point |
| `docs/store-release-polish/IMPLEMENTATION.md` | W0–W5 implementation instructions |
| `docs/store-release-polish/ACCEPTANCE.md` | R01–R37 status and verification evidence |
| `docs/concept.md` | The philosophy and world of Zanshin |
| `docs/design-system.md` | Colors, typography, spacing, motifs, animation |
| `docs/mvp-spec.md` | What to build in MVP — and what NOT to build |
| `docs/development-phases.md` | Phase-by-phase roadmap and rules |

---

## When in Doubt

Ask: **"Does this make the app more quiet, or more noisy?"**

If more noisy — stop.  
If more quiet — proceed with care.
