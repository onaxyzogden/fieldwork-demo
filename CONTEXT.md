# Fieldwork — Root Context (Layer 1 Task Router)

## Workspace Map
| If your task involves… | Go to workspace | Read first |
|---|---|---|
| Building features, fixing bugs, modifying UI or logic | `src/` | `src/main.tsx` |
| Reading or updating project documentation, product ADRs | `docs/` | `docs/design-decisions.md` |
| The intake catalogue (questions and issues CSVs, generated and checked by script) | `catalogue/` | `catalogue/README.md` |
| Build checks: the design, catalogue and status checks that gate the build | `scripts/` | `README.md` |
| The /wiki skill (ingest, query, update, lint) | `.claude/skills/` | `.claude/skills/wiki.md` |
| Browsing accumulated knowledge, decisions, synthesis | `wiki/` | `wiki/SCHEMA.md` |

## Project Entry Points
- **App bootstrap**: `index.html` → `src/main.tsx` → `src/Workspace.tsx` (exports App)
- **Build config**: `vite.config.ts` (relative base), `tsconfig.json`, `package.json` (dev, test, build), `.github/workflows/pages.yml` (deploys main to GitHub Pages)
- **Workflow principles**: `docs/design-decisions.md` (product ADRs 001 onward, linked by number, never copied into the wiki), `DESIGN.md` (design system), `CLARIFICATION-CATALOGUE.md`
- **LLM Wiki**: `wiki/index.md` (catalog), `wiki/log.md` (chronological record, newest first), `wiki/decisions/` (process and tooling decisions only)

## Session Protocol
The global stages apply here unchanged: start from `~/.claude/workspace/CONTEXT.md`.
This file is read in Stage 03 (plan) and Stage 04 (execute). It routes; it does not instruct.
Project-specific rules (stack, commands, conventions) belong in this project's README.md and DESIGN.md, not here.
This repository is public: keep this file and the wiki to project facts.

## Layer Annotation
L1 router. Each "Read first" target is that workspace's own L2 or L3 entry point.
`wiki/` is L3 when Stage 02 reads it and L4 when Stage 05 writes to it.
