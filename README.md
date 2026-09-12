# Fieldwork — Interactive Handyman Platform Prototype

[Open the demo](https://onaxyzogden.github.io/fieldwork-demo/)

A responsive prototype for evaluating customer intake, operator scheduling and dispatch, and contractor job offers. All sample names, properties, prices, and transactions are fictional. This is a demonstration, not a live booking or payment service.

## Try the demo

Open the link on a computer, tablet, or smartphone. Use the role switcher and five scenario shortcuts:

1. **Door adjustment:** Customer → describe/clarify/confirm → address → approved appointment → simulated payment → confirmed visit.
2. **Four-task visit:** Operator → Do It Myself → create a bundled visit → send quote. Customer approves and pays in the simulation.
3. **Delegate a job:** Operator selects a contractor and sends an offer. Contractor accepts. Customer approves the quote and pays before confirmation.
4. **Needs review:** Restricted work requires operator review and an eligible specialist; ordinary Instant Book is blocked.
5. **Decline & reassign:** Contractor declines the TV mounting offer. The operator sees an actionable alert and can choose another contractor or Do It Myself.

Optional automatic reoffers are in Operator → Demo settings. They retain the appointment and pay, notify the operator, and require an eligible contractor. No suitable replacement leaves the operator an action-required alert.

The sun/moon button switches themes. Demo settings can reset sample data or advance the simulated clock. Requests, offers, payments, settings, and notifications are saved in each browser independently. They do not synchronize between devices. Visitors never receive another visitor's locally entered information.

## Run locally

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite with `/fieldwork-demo/` as the path. Run `npm test` for the business-rule tests and `npm run build` to generate the static site in `dist/`.

## Deployment

Push changes to `main`. GitHub Actions installs dependencies, runs tests, builds the site, and publishes to GitHub Pages. The workflow can also be started manually from Actions. Pages must use **GitHub Actions** as its build source.

`vite.config.ts` sets the base path to `/fieldwork-demo/`. If the repository is renamed, update that value and the demo link.

## Prototype boundaries

- Service Request → Tasks → Visit → Assignment are separate records; quotes and payments have independent state.
- Rule-based classification and deterministic scheduling; no external AI, geocoding, or traffic service.
- CAD prices and America/Toronto appointment times; sample dates are relative to initial load.
- Payments and notifications are simulated. No real charges, messages, authentication, or credential verification.
- Role switching demonstrates workflows; it is not a security boundary.
- Optional photos stay in browser storage. Only use non-sensitive test data.
- No offline installation or service worker. An internet connection is required to load the app.
- Light/dark themes and responsive layouts support phones, tablets, and desktops.

## Source guide

- `src/main.tsx`: role workspaces and UI interactions.
- `src/model.ts`: classification, scheduling, eligibility, and lifecycle state.
- `src/dispatch.ts`: decline handling, replacement offers, and operator notifications.
- `src/style.css`, `src/light.css`: responsive layouts and themes.
- `src/*.test.ts`: regression tests.

## Typography verification

Shared rem sizing is defined in `src/typography.css`: body/form values 16px, introductory text 18px, headings 32–40/28–30/24px, labels 14px, compact captions 12px. Body line height is 1.6; headings and labels use 1.5. Layouts wrap and stack around larger text without page-wide overflow clipping.

Checked all three roles in both themes at 320, 390, 461, 768, and 1280px, including intake steps, request detail, routes, contractor offers/assignments, and a completed simulated booking. Checkout was checked at those widths and 640px. No horizontal page overflow was found in these checks. All 26 regression tests and the production build pass.

Browser zoom remains unrestricted. A 640px viewport checks the reflow width equivalent to 200% zoom on a 1280px window; actual browser-chrome 200% zoom was unavailable in the automated browser and remains a manual verification item.

## Issue-specific clarification

The intake library now covers 25 handyman and specialist issue types. See [the question table](CLARIFICATION-CATALOGUE.md). Customers get relevant choices, editable explicit details, optional photos, and conditional drain-product follow-ups. Answers remain attached to individual tasks and appear in customer, operator, and contractor details. Specialist intake stays on Request to Book and requires review. Existing saved answers remain compatible; no reset is needed.

Validation: 67 tests pass, including all 25 issue matches, drainage/leak distinctions, ambiguous and negative phrases, saved legacy answers, specialist booking restrictions, and door scope limits. The clogged-sink request was exercised through submission and refresh into operator Needs Review. Clarification controls fit 320, 390, 461, 768, and 1280px in both themes.

## Expanded editable catalogue

The matrix is now merged into 81 canonical issues and 268 questions. See [the full table](CLARIFICATION-CATALOGUE.md) and [editing instructions](catalogue/README.md). The two CSV files are the source of truth; generated data is checked before tests and deployment. Source row numbers preserve traceability across all 78 imported rows. No supplied licensing flag is treated as a verified qualification.

Validation includes 163 application tests and eight CSV/compiler tests. Representative checks cover specific-vs-generic matches, every canonical example, negative phrases, source coverage, saved answers, and referral-only assignment rejection. Referral intake explicitly states that the service is not bookable through the platform.

## Three-screen customer intake

Customer intake now uses Tasks → Where and when → Done. One editor is open at a time; saved tasks collapse to short rows. Save task opens its catalogue questions; Done with this task saves customer entry without approving operator scope. Unanswered details can explicitly be marked Not sure. Remove offers Undo. The address and optional draft progress persist without resetting old records.

The combined booking screen offers up to three slots plus More times, using one eligible provider and the total task duration. Request to Book options remain preferences. Uncertain or oversized scope uses general timing; referral-only work has no bookable slots. Instant Book uses the existing simulated checkout with availability revalidation. The receipt distinguishes requests from confirmed appointments.

Verified: six-task entry, removal/Undo, reopened drafts after refresh, a four-task 240-minute recommendation, address changes, uncertain multi-visit scope, and Instant Book with a More times selection and failed-payment retry. Task, booking, and dialog layouts were checked at 320, 390, 461, 768, and 1280px. Photos retain task IDs and are covered by persistence checks. Browser-chrome 200% zoom remains unavailable in the automated browser; narrow-width reflow was checked, and actual zoom remains a manual check. The bottom action area stays in document flow so it cannot cover the keyboard or form content.

Validation: 173 application tests plus eight catalogue/compiler tests; production build passes. `src/CustomerIntake.tsx` owns the customer screens, and `src/intake.ts` contains draft completion and recommendation helpers. Scheduling retains its existing default limit, with an optional larger result limit for More times.

## Operator and contractor workflow update

Operator navigation is Home, Requests, Today, and More. Home prioritizes declines and unresolved work, with waiting items separate. Requests has Needs Action, Waiting, Scheduled, and history filters. Expand task rows for classification and split/merge controls; choose fulfillment to reveal provider/time recommendations. Quotes remain under Customer pricing & quotes. Today defaults to a timeline with optional illustrative map and external map links.

Contractor walkthrough: choose a demo contractor, open Your Work > Offers, view the exact pay and task list, then accept or decline with an optional reason. Acceptance does not bypass customer quote/payment requirements. Once confirmed, open the assignment, mark On my way, Start job, open each task, and choose an outcome. Before/after photos and notes are optional. Complete job opens a review dialog; Finish job ends the visit. Unresolved tasks create operator attention without another appointment or payment. Yousef has the same execution controls in confirmed request details and Today.

Execution data is optional and persisted per visit/task. Customer reference photos remain separate. Messages and notifications are in-app simulations; navigation opens external maps only. ETA uses the simulated clock and travel allowance, not GPS. Demo users can exercise a future confirmed assignment without waiting for its calendar date. Browser storage remains local and is not shared across devices.

Validation: 183 application tests plus 8 catalogue tests passed; production build passed. Browser checks exercised decline/reassignment visibility, self-assigned start, outcome gating, partial completion, and refresh persistence. Home, review, contractor views, and completion dialog were checked at 320/390/461/768/1280px; contractor layouts in both themes. Actual 200% browser zoom and real mobile keyboard/photo-picker behavior require manual device checks. No production messages or payments were sent.

## Developer blueprint

Open `?view=blueprint` or Demo settings → Developer blueprint. This separate view does not mount the booking app and does not write browser storage, even when its theme or filters change. It documents eight stages across Customer, Operator, Contractor and System, with six read-only example paths, linked entity/state references, and explicit implementation gaps. It does not execute scenarios.

Use Print / Save PDF for the complete landscape overview, all eight stage detail pages, and state/exception references. Print content is independent of the selected role or example. The checked Edge export is 15 A4 landscape pages. Browser print settings can change pagination.

Verification: direct link and refresh; role/path selection and stage focus; light/dark layouts at 320, 390, 461, 768 and 1280px. An isolated browser check loaded the actual entrypoint, exercised filters/stage selection, and confirmed zero storage writes with the demo record string unchanged. The printed overview, stage pages and reference/exception pages were visually inspected. Existing booking data and synced references were not changed.

### Blue theme and operator layout
All roles and the blueprint use navy/blue themes. Operator Home uses separate attention cards and daily metric tiles. Mobile navigation is in the header drawer; sample scenarios are under Demo settings. Contractor recommendations match all selected tasks using the same scope rules as offer eligibility, with availability shown separately.
