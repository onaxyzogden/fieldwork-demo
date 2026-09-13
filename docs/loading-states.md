# Future API loading states (design only)

The prototype remains synchronous. Do not simulate delays or show skeletons today.

| View | First load | Refresh/partial data | Empty/error/offline |
|---|---|---|---|
| Customer requests | Three card-shaped static placeholders with accessible “Loading requests” status; preserve header/new-request action | Keep existing cards visible, mark refreshing; preserve selected request and draft | Empty explains how to start; failure offers retry without losing drafts; offline shows last saved data labelled stale |
| Operator queue | Three queue-row placeholders and loading totals, never fake zero counts | Keep rows and filters; show refresh status; unavailable detail section has local retry | Empty differentiates no requests from no filter matches; errors retain filters; offline disables authoritative dispatch submission and explains why |
| Contractor offers | Two offer-card placeholders, no invented pay or appointment | Keep loaded offers; revalidate expiry before acceptance; one failed card does not blank the list | Empty distinguishes no offers from end of day; retry preserves tab; offline marks offers stale and prevents false acceptance |

No percentage bar without real progress data. Skeletons match expected geometry and are hidden from assistive technology; the parent exposes `aria-busy` and a concise live status. Reduced-motion mode uses static placeholders. Financial, scheduling and acceptance actions wait for authoritative success; retry must be idempotent. These are proposed production behaviors, not capabilities implemented in this prototype.
