---
title: "Accessibility audit (2026-10)"
type: source
ingested: 2026-10-14
created: 2026-10-14
updated: 2026-10-15
source_path: "session transcript (design:accessibility-review, entire site)"
source_type: conversation
tags: [audit, accessibility, wcag, operator, contractor, customer]
---

# Accessibility audit (2026-10)

## Summary
A WCAG 2.1 AA audit of the whole platform, run on the dev server after ADR 080 (PR #56).

**Method:**
- An automated scan of 16 live screens: every role, every main page, in light and dark mode.
- A keyboard pass.
- Computed contrast for text, and for controls' borders and states.
- A reflow test at 320 px wide.
- A code read for names, roles, states, headings, landmarks, dialogs and live regions.

It was not tested with a real screen reader. No source was changed by the audit.

**Result:** 23 findings: 0 critical, 6 major and 17 minor. The worst focus and announcement problems were already fixed by [[platform-ux-audit-2026-10]] (ADR 079–080). What's left is mostly in two places: how controls look (their borders and selected state) and how state is exposed to screen readers. **The 6 majors are fixed in ADR 081** (PR #57, merged), **and the 17 minors in ADR 082**.

## What passes
- **Text contrast:** zero text-contrast failures on 16 screens × 2 themes. Muted text in light mode is 6.3:1.
- **Focus:** the ring is 2px with a 4px offset, visible in both themes (5.9:1 in light).
- **Reflow:** no horizontal scroll at 320 px. All type is in rem, and zoom isn't blocked.
- **Motion:** reduced motion is honoured.
- **Names and labels:** `lang="en"` is set. Every icon-only button has a name, and every input has a label.
- **Queues:** they trap focus and close on Escape.
- **Announcements:** toasts use mounted live regions. Intake errors use `aria-invalid` plus `aria-describedby`.

## Key Extractions

### Major
| # | WCAG | Finding |
|---|---|---|
| 1 | 1.4.11 | Input, select and textarea borders are 1.31–1.42:1 in light mode (`#dcd8d2`) and 1.34:1 in dark mode (`#2e3540` on `#1b1f26`). The field fill differs from the page by 1.08:1 |
| 2 | 1.4.1 | A selected time pill, date chip or slot differs by hue only, and its border is 2.24:1. The text colours are about the same luminance (`#8a5a12` and `#5c6270`), and the backgrounds are 1.04:1 apart |
| 3 | 1.3.1, 1.4.1 | The customer's status track (`CustomerWorkspace.tsx:576`) and `Assessment.tsx:368` mark done and current by class only |
| 4 | 2.4.3, 2.1.1 | `JobMode.tsx:118` and `OnSite.tsx:84` are `role="dialog" aria-modal`, but have no Escape, no Tab trap and nothing inert behind them |
| 5 | 2.2.1 | Toasts hide after 3.5 s (7 s for errors), with no pause or dismiss (`useWorkspaceState.tsx:89`) |
| 6 | 4.1.2 | Selection is shown by class only, with no `aria-pressed` or `aria-current`, on: <ul><li>the queue item (`OperatorRequests.tsx:1000`)</li><li>the slot (`:1590`)</li><li>the provider card (`Workspace.tsx:487`)</li><li>the Blueprint path (`Blueprint.tsx:207`)</li><li>OnSite pricing (`OnSite.tsx:515, 521`)</li><li>Approve / Not now (`Assessment.tsx:555, 565`)</li><li>the scenarios (`Shell.tsx:410`)</li></ul> |

### Minor
- **Step-summary check:** 2.64:1 in light mode (`layout.css:1036`).
- **Heading skips:**
  - h1→h3: `CustomerIntake.tsx:900`, `Walkthroughs.tsx:192` and `:504`, `Assessment.tsx:352`.
  - h1→h4: `CustomerWorkspace.tsx:404`.
  - h2→h4: `OperatorRequests.tsx:1470`.
- **Prices as headings:** `Workspace.tsx:345` (an h1), and `CustomerWorkspace.tsx:217, 275`.
- **Colour only:** "Soon" (`When.tsx:24`), the online dot (`Shell.tsx:164`), and an intake step's done state (`CustomerIntake.tsx:475`).
- **No `autocomplete`** on Unit (`address-line2`) or Municipality (`address-level2`).
- **Decorative lucide icons** (about 97) have no `aria-hidden`. Lucide v0.468 doesn't add it.
- **No skip link.** The `.bp-skip` pattern exists in `blueprint.css:403`.
- **Targets of 24–44 px:** photo remove, `.map-expand`, `button.badge`, `.time-pill`, and the role switch on desktop. They pass 2.2's 24 px minimum.
- **Dead brand link:** `href="#"` (`Shell.tsx:148`).
- **The `fields.tsx` `Message` sits inside the `<label>`,** so the error becomes part of the field's name. `invalid()` has no `aria-describedby`.
- **Errors with no control:**
  - `CustomerWorkspace.tsx:258`
  - `OperatorRequests.tsx:1487, 1488, 1587`
  - `Workspace.tsx:342, 721, 824`
- **Intake:** a failed Continue leaves focus on the button.
- **"Not sure" is in the input's name:** `RequestFields.tsx:157-203` puts the button inside the input's label.
- **Landmarks:** the sidebar `<nav>` is unlabelled, and the `<footer>` sits inside `<main>`.
- **Disclosures:** "New walkthrough" has no `aria-expanded`, and `aria-controls` is missing at `JobMode.tsx:99`, `OnSite.tsx:237` and `OperatorRequests.tsx:963`.
- **Live regions:**
  - `aria-live` covers the whole Blueprint path.
  - The `incoming-notice` status region mounts together with its first message.
  - "Close navigation ×" reads the × aloud.

## How the majors were fixed (ADR 081)
- **#1:** a `--field-border` token: `#6b7482` in dark and `#878b94` in light. The proposed `#8b8f98` came to 3.0:1 on the light page, so it went one step darker. `design:check` computes the ratio on every build.
- **#2:** a doubled edge in `--accent-text` (`--shadow-chosen`) on every selected pill, chip, slot, queue item, provider card and "who" card. It is not a check mark: there is no room for one in the 36 px pills or the column cards.
- **#3 and #6:** `aria-pressed` or `aria-current` on each, and a global `.sr-only` ", done" on the status tracks. The current step is also weight 600.
- **#4:** `QueueLayer`'s trap became `useModal`, which `JobMode` and `OnSite` now share.
- **#5:** the toast holds while it is hovered or focused, has a Dismiss button, and an error has no timer.
- **Found while fixing:** Approve and Not now at `Assessment.tsx:555` can't be reached, because `FindingReview` always renders locked. They got `aria-pressed` anyway; removing them is left for later.

## How the minors were fixed (ADR 082)
- **Structure:** heading skips moved up (`.panel-title h2` sized as the h3 was); prices are `<p className="price-figure">`; the sidebar is `<nav aria-label="Pages">`; both footers sit beside `<main>`; "Skip to content" (shared `.skip-link`) focuses `<main>`; the brand is a `<span>`.
- **Names:** each `Message` sits after its `<label>` with an id, and `invalid()` adds `aria-describedby`. A `.field-label` wrapper is `display: contents`, so layouts hold. Errors with no field describe their group or button. "Not sure" and hints are outside the name. The intake's photo-only Continue shows an inline error and focuses the description. Street, unit and municipality have `autocomplete`.
- **Colour:** the done check fills with `--success-fill` (about 8:1), checked by `design:check`. ", soon", ", done" and an "Online" image name.
- **Disclosures and live regions:** `aria-controls` on four toggles (only while open where the panel is conditional); the incoming region stays mounted; the Blueprint announces only its description; "Close navigation" is named without the ×.
- **Icons:** every lucide icon has `aria-hidden`, and `design:check` fails one without it (an `Icon` alias included). The audit's "about 97" was 111.
- **Targets:** `.map-expand`, photo remove and `button.badge` are 32 px on desktop. The time pill (36 px) and the role switch (44 px) already were.

## Related
- [[platform-ux-audit-2026-10]]
- [[customer-ux-audit-2026-10]]
- [[fieldwork]]
