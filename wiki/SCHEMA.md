# Wiki Schema — Fieldwork

This file governs how Claude maintains this wiki. Read it before any wiki operation. It follows the schema of the MAQASID OS wiki, with the differences below.

## Purpose

The wiki is a persistent knowledge base that Claude maintains across sessions. It records what the code and the ADR log don't: the current state, what is deferred, how work is verified, and what each session did. Sessions orient from it before working (Gate 2 in the operator's global CLAUDE.md).

## How this wiki differs from the MAQASID wiki

1. **ADRs stay in `docs/design-decisions.md`.** That file is the decision record for the product (ADR 001 onward), and it ships with the code. Wiki pages link to an ADR by number ("ADR 072"); they never copy one. `wiki/decisions/` is only for choices about process, tooling or the wiki itself, which don't belong in the product ADR log.
2. **This repository is public.** Anything committed here can be read by anyone. Keep the wiki to project facts. No personal data, credentials, private business terms, or notes meant only for the operator. Those belong in the MAQASID wiki, which is private.
3. **Merging to `main` deploys** to j.ogden.ag through GitHub Pages. A wiki-only change still goes through a PR.

## Directory Layout

```
wiki/
  SCHEMA.md       # This file
  index.md        # Catalog of all pages (read first)
  log.md          # Append-only session record, newest first
  entities/       # The product, its roles, modules and tools
  concepts/       # Patterns and principles that recur across ADRs
  decisions/      # Process/tooling decisions only (product ADRs: docs/design-decisions.md)
  sources/        # Digests of ingested documents (audits, briefs)
  synthesis/      # Cross-cutting analyses, filed query results
```

## Page Types, Naming, Frontmatter, Cross-Referencing

These are the same as the MAQASID wiki:
- Every page has YAML frontmatter: `title`, `type`, `created`, `updated`, `tags`.
- Filenames are kebab-case. Decisions are named `YYYY-MM-DD-slug.md`.
- Use `[[wikilinks]]` everywhere, and leave no orphan pages.
- Entity pages have these sections: Key Facts, Architecture / Structure, Current Status, Connections, Open Questions, History.

## Operations

- **Ingest** (`/wiki ingest <file>`): read the source and write a digest in `sources/`. Update the entity and concept pages it touches, then the index and the log.
- **Query** (`/wiki query "<q>"`): read the index and the relevant pages, answer with wikilinks, and offer to file a substantive answer in `synthesis/`.
- **Update** (end of session): bring the touched entity pages up to date and append a log entry:
  ```
  ## [YYYY-MM-DD] session | objective
  - Completed / ADRs / PR / Deferred / Pages touched
  ```
  If a session changed process or tooling, file that decision in `decisions/`. Flag any contradiction with a `> [!warning] Contradiction` callout.
- **Lint** (`/wiki lint`): check for orphans, dead links, stale pages (30+ days), missing pages, frontmatter gaps, and contradictions.

## Anti-Patterns

- Don't copy ADR text. Link it by number.
- Don't store in-progress task state. Record outcomes and what was deferred.
- Don't delete pages. Mark them `status: deprecated` and say why.
- Don't skip the log.
