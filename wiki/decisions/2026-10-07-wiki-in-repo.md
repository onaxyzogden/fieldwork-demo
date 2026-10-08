---
title: "Fieldwork's wiki lives in this repository"
type: decision
date: 2026-10-07
created: 2026-10-07
updated: 2026-10-07
status: accepted
tags: [process, wiki]
superseded_by: null
---

# Fieldwork's wiki lives in this repository

## Context
The operator's global CLAUDE.md has every session orient from `wiki/` in the project (Gate 2) and update it at close. Fieldwork had no wiki, so sessions skipped that step.

## Decision
Keep a `wiki/` in this repository, on the MAQASID wiki's schema, with the `/wiki` skill at `.claude/skills/wiki.md`. The operator chose this on 2026-10-07.

## Rationale
It satisfies Gate 2 literally, and the wiki travels with the code it describes.

## Alternatives Considered
- **A Fieldwork page in the central MAQASID wiki.** One hub across Ogden projects, and nothing published. Not chosen.
- **Both, linked.** Not chosen.

## Consequences
- The repository is public, so the wiki is too. See [[SCHEMA]], rule 2.
- Product ADRs stay in `docs/design-decisions.md`, and the wiki links to them, so nothing is duplicated.
- Wiki changes go through PRs, like the code.

## Connections
- [[fieldwork]]
