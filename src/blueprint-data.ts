export const roles = ["Customer", "Operator", "Contractor", "System"] as const;
export type Role = (typeof roles)[number];
export type Capability = "Implemented" | "Simulated" | "Production gap";
export type Stage = {
  id: string;
  title: string;
  subtitle: string;
  trigger: string;
  gate: string;
  records: string[];
  lanes: Record<Role, { title: string; body: string }>;
  notifications: string;
  next: string;
  capability: Capability;
  evidence: string[];
};
export const stages: Stage[] = [
  {
    id: "submit",
    title: "Submit",
    subtitle: "One request. Independent tasks.",
    trigger:
      "Customer sends a Request to Book, or begins the eligible Instant Book checkout.",
    gate: "Task entry is finished or explicitly uncertain; a valid shared service address is supplied. Referral-only work follows referral review.",
    records: ["request", "task"],
    lanes: {
      Customer: {
        title: "Describe each task",
        body: "Tasks → Where and when → Done. Photos and clarification answers belong to each task. Preferred time is not a confirmed appointment.",
      },
      Operator: {
        title: "New work to review",
        body: "Submitted or Needs Review requests appear in the queue. Drafts remain a separate filter.",
      },
      Contractor: {
        title: "Not involved yet",
        body: "No offer exists just because a customer entered tasks.",
      },
      System: {
        title: "Save request + tasks",
        body: "Drafts persist locally. Saving task entry creates neither a visit nor an assignment. Instant Book creates its booking records only through checkout.",
      },
    },
    notifications:
      "Submission is reflected in the operator queue and activity history. There is no real push, email, or SMS delivery.",
    next: "Review uncertain scope; predictable eligible work can follow Instant Book checkout.",
    capability: "Implemented",
    evidence: ["src/CustomerIntake.tsx", "src/intake.ts", "src/main.tsx"],
  },
  {
    id: "review",
    title: "Review",
    subtitle: "Understand scope before promising work.",
    trigger: "Operator opens a request and its task rows.",
    gate: "Review flags remain in force until the operator reviews scope; restricted work still requires an eligible provider. Referral-only work cannot become an ordinary booking.",
    records: ["task", "request", "quote"],
    lanes: {
      Customer: {
        title: "Review is pending",
        body: "Sees request progress and any information request. Can add task-specific photos and respond with details.",
      },
      Operator: {
        title: "Review and price",
        body: "Inspects answers, photos, classification reasons and duration; can correct, merge or split tasks and send a separate quote.",
      },
      Contractor: {
        title: "Not involved yet",
        body: "No contractor decision is required during initial scope review.",
      },
      System: {
        title: "Classify and reconcile",
        body: "Local phrase/catalogue matching suggests scope. Unreviewed tasks keep the request in Needs Review; customer task completion is not operator approval.",
      },
    },
    notifications:
      "Information requests are stored in request notes and activity. A dedicated customer push channel and complete information-request state machine are not implemented.",
    next: "Choose fulfillment, request more information, decline the request, or retain referral review.",
    capability: "Implemented",
    evidence: ["src/clarification.ts", "src/model.ts", "src/main.tsx"],
  },
  {
    id: "fulfillment",
    title: "Choose fulfillment",
    subtitle: "Who can do this work?",
    trigger:
      "Operator opens the focused Do It Myself or Assign Contractor screen from Request Details. Back returns to the request without sending an offer.",
    gate: "Provider eligibility, skills and review requirements must fit the selected tasks.",
    records: ["task"],
    lanes: {
      Customer: {
        title: "Still awaiting a plan",
        body: "Selecting a provider alone does not confirm anything for the customer.",
      },
      Operator: {
        title: "Choose the provider",
        body: "Sees only providers matching every selected task under existing review and eligibility rules. Task-specific reasons explain the match; fitting appointments are separate from scope suitability. Customer price and contractor pay remain separate.",
      },
      Contractor: {
        title: "No offer sent yet",
        body: "An offer appears only after the operator creates the visit and sends it.",
      },
      System: {
        title: "Selection only",
        body: "Provider and task selections are interface state. This selection action alone creates no assignment and sends no notification.",
      },
    },
    notifications: "No notification is sent by provider selection alone.",
    next: "Choose one provider-specific appointment; split the work if a single visit cannot fit.",
    capability: "Implemented",
    evidence: ["src/main.tsx", "src/model.ts"],
  },
  {
    id: "schedule",
    title: "Schedule / Offer",
    subtitle: "One provider. One proposed appointment.",
    trigger:
      "Operator creates a visit, with a contractor offer or self-assignment.",
    gate: "Selected tasks must not be double scheduled. Duration, working hours, customer preferences, travel allowances and buffers must fit.",
    records: ["visit", "assignment", "quote"],
    lanes: {
      Customer: {
        title: "Proposed, not confirmed",
        body: "Can review a quote and pay when applicable. Request-to-Book time preferences do not themselves create confirmed bookings.",
      },
      Operator: {
        title: "Create visit / send offer",
        body: "Selects one appointment and sets contractor compensation. Scheduling explanations describe simulated route fit.",
      },
      Contractor: {
        title: "Review the offer",
        body: "Sees the visit’s tasks, city, proposed time, duration, reference photos and exact pay. Can accept or decline before expiry.",
      },
      System: {
        title: "Visit + assignment",
        body: "A contractor assignment starts Offered; self-assignment starts Accepted. Appointment stays Proposed until confirmation requirements are satisfied.",
      },
    },
    notifications:
      "Offer and assignment changes are local records. Default offers expire after two simulated hours. Automatic reoffers are optional and off by default.",
    next: "Acceptance and customer quote/payment checks, or decline/expiry and reassignment.",
    capability: "Simulated",
    evidence: ["src/main.tsx", "src/model.ts", "src/dispatch.ts"],
  },
  {
    id: "confirm",
    title: "Confirm",
    subtitle: "Acceptance is one gate, not the whole gate.",
    trigger:
      "Assignment acceptance, quote approval or payment changes cause reconciliation.",
    gate: "All active tasks covered; current providers accepted and eligible; active quote approved; payment paid unless pay-on-completion applies.",
    records: ["request", "visit", "assignment", "quote", "payment"],
    lanes: {
      Customer: {
        title: "Visit is confirmed",
        body: "Sees confirmation only after all existing requirements succeed. Instant Book includes simulated payment and availability revalidation.",
      },
      Operator: {
        title: "Ready for the schedule",
        body: "Tracks acceptance, quote and payment independently. A decline needing reassignment takes attention priority over a pending quote.",
      },
      Contractor: {
        title: "Job accepted",
        body: "Immediately sees acceptance. If customer conditions remain unmet, the screen explicitly says final confirmation is pending.",
      },
      System: {
        title: "Reconcile the records",
        body: "Assignment Accepted does not alone set the visit to Confirmed. Quote approval does not bypass an unaccepted assignment.",
      },
    },
    notifications:
      "Acceptance creates a persisted operator notification. No real calendar sync, charge or external confirmation message is sent.",
    next: "Confirmed work can move to On the Way or Start job; rescheduling/cancellation follow existing policies.",
    capability: "Implemented",
    evidence: ["src/model.ts", "src/dispatch.ts", "src/main.tsx"],
  },
  {
    id: "way",
    title: "On the Way",
    subtitle: "Travel progress, separate from booking state.",
    trigger: "Current accepted provider taps On my way on a confirmed visit.",
    gate: "Provider owns the current accepted assignment; visit is confirmed and has not finished, started or been cancelled.",
    records: ["execution", "notification", "visit"],
    lanes: {
      Customer: {
        title: "On the Way label",
        body: "Visit card derives the travel label from execution data. A live tracking map and dedicated live ETA experience are not implemented.",
      },
      Operator: {
        title: "Timeline updates",
        body: "Sees On the Way or an Issue when simulated ETA is later than the appointment start; an operator notification records the action.",
      },
      Contractor: {
        title: "Share travel progress",
        body: "On my way records the status. Navigate separately opens external maps; opening maps does not change job status.",
      },
      System: {
        title: "Timestamp + mock ETA",
        body: "Writes onWayAt and eta inside visit execution. ETA is demo clock plus the visit travel allowance. Stored visit status remains Confirmed.",
      },
    },
    notifications:
      "Linked operator notification and activity entry are persisted. GPS tracking, background ETA refresh and push delivery are production gaps.",
    next: "Start job. Duplicate On my way actions are rejected.",
    capability: "Simulated",
    evidence: ["src/work.ts", "src/ContractorWork.tsx", "src/OperatorWork.tsx"],
  },
  {
    id: "progress",
    title: "In Progress",
    subtitle: "Record outcomes for each task.",
    trigger:
      "Current accepted provider taps Start job, then records task outcomes.",
    gate: "Visit must be Confirmed or already In Progress, assigned to this provider and unfinished. Duplicate starts are rejected.",
    records: ["visit", "execution", "notification"],
    lanes: {
      Customer: {
        title: "Work is underway",
        body: "Visit card shows In Progress. Simulated messages appear in the portal; a customer-facing live per-task checklist is not implemented.",
      },
      Operator: {
        title: "Monitor task outcomes",
        body: "Can inspect execution details and individual outcomes. Yousef has the same work controls for self-assigned visits.",
      },
      Contractor: {
        title: "Work through the list",
        body: "Records Completed, Needs return visit, Unable to complete, Customer declined or Materials required. Before/after photos and notes are optional.",
      },
      System: {
        title: "Visit-scoped outcomes",
        body: "Writes startedAt and sets Visit.status to In Progress. Outcomes are keyed by task ID inside that visit; work photos do not overwrite customer reference photos.",
      },
    },
    notifications:
      "Start and simulated customer messages create operator notifications. Task outcome edits persist locally; they do not generate a notification for every edit.",
    next: "Complete job becomes available after every task has an outcome. Then review and explicitly finish.",
    capability: "Implemented",
    evidence: ["src/work.ts", "src/ContractorWork.tsx", "src/main.tsx"],
  },
  {
    id: "finish",
    title: "Finish",
    subtitle: "Close the visit, preserve unfinished work.",
    trigger: "Provider reviews the completion summary and taps Finish job.",
    gate: "Visit started, still belongs to the accepted provider, is not cancelled, and every task has a supported outcome.",
    records: ["visit", "task", "execution", "request", "notification"],
    lanes: {
      Customer: {
        title: "Completion or follow-up",
        body: "Sees completed visit or a message that remaining work needs operator review. This does not promise an automatic return appointment.",
      },
      Operator: {
        title: "Resolve remaining work",
        body: "Unresolved outcomes appear as Issue / Operator follow-up. Fully completed requests move to history after all tasks and visits are complete.",
      },
      Contractor: {
        title: "Visit finished",
        body: "Sees the result and can return to Today. Completed visits remain in history; finished outcomes cannot be edited through work controls.",
      },
      System: {
        title: "Finish without charging",
        body: "Writes finishedAt and Visit.status Completed. Only successful task outcomes mark tasks Completed. No return visit, payment or contractor settlement is automatically created.",
      },
    },
    notifications:
      "A linked operator notification records completion or follow-up. Customer completion messaging is an in-app simulation.",
    next: "Next work, operator follow-up, or completed history. Production payout, review collection and follow-up scheduling remain separate gaps.",
    capability: "Implemented",
    evidence: ["src/work.ts", "src/model.ts", "src/main.tsx"],
  },
];
export type Entity = {
  id: string;
  name: string;
  owns: string;
  states: string;
  links: string[];
  note: string;
};
export const entities: Entity[] = [
  {
    id: "request",
    name: "Service Request",
    owns: "Customer, property, task grouping, booking mode and preferences.",
    states:
      "Stored: Draft, Submitted, Needs Review, Awaiting Quote Approval, Awaiting Provider Acceptance, Awaiting Payment, Confirmed, Completed, Cancelled, Declined.",
    links: ["task", "visit", "quote"],
    note: "Reconciliation derives most stored status changes. Information requests currently use notes, not a fully wired stored waiting status.",
  },
  {
    id: "task",
    name: "Task",
    owns: "Independent description, clarification answers, reference photos, classification, duration and review flags.",
    states:
      "Optional stored status: unassigned, assigned to visit, Completed. Entry stage: description, details, done. mergedInto retains the original record.",
    links: ["request", "visit", "execution"],
    note: "Entry completion is customer input progress, not scope approval. Per-visit work outcomes are separate from Task.status.",
  },
  {
    id: "visit",
    name: "Visit / Booking",
    owns: "Task IDs, provider, appointment, duration and simulated travel allowance.",
    states:
      "Stored: Proposed, Confirmed, In Progress, Completed, Cancelled. Display may instead show On the Way or Issue.",
    links: ["request", "task", "assignment", "execution"],
    note: "One request can have several visits. Proposed and confirmed appointments are distinct.",
  },
  {
    id: "assignment",
    name: "Assignment / Offer",
    owns: "Visit, provider, exact contractor pay, expiry and optional decline reason.",
    states:
      "Used: Offered, Accepted, Declined, Expired, Reassigned, Cancelled. Legacy Completed assignments are supported by older UI paths; current finishing leaves the accepted assignment intact.",
    links: ["visit", "notification"],
    note: "Sequential offer history persists. An accepted replacement must still satisfy the customer confirmation gates.",
  },
  {
    id: "quote",
    name: "Quote",
    owns: "Customer price, pricing path, notes and pay-on-completion flag.",
    states:
      "Stored: Sent, Approved, Declined, Superseded. Pricing paths: Fixed price, Estimated range, Manual quote.",
    links: ["request", "payment"],
    note: "Customer price is separate from assignment pay. An approved quote alone cannot confirm an unaccepted provider.",
  },
  {
    id: "payment",
    name: "Payment",
    owns: "Quote reference, amount and simulated transaction reference.",
    states: "Stored: Paid, Failed, Refunded.",
    links: ["quote"],
    note: "No real charges. Retry creates another simulated payment record. Cancellation can mark paid records Refunded; finishing does not settle payment.",
  },
  {
    id: "execution",
    name: "Visit execution & messages",
    owns: "onWayAt, eta, startedAt, finishedAt; outcomes keyed by task ID; before/after photos, notes. Messages sit on the visit.",
    states:
      "Outcome values: Completed, Needs return visit, Unable to complete, Customer declined, Materials required.",
    links: ["visit", "task", "notification"],
    note: "Optional fields initialize lazily. No execution migration replaces existing bookings. Messages and photos remain browser-local.",
  },
  {
    id: "notification",
    name: "Operator notification",
    owns: "Assignment, visit and request references; kind, text, timestamp and read flag.",
    states: "Read / unread, independent of dispatch attention.",
    links: ["assignment", "visit", "request"],
    note: "Reading an alert does not resolve a decline or unfinished task. Attention comes from records, not notification read status.",
  },
];
export const examples = [
  {
    id: "instant",
    name: "Instant Book",
    steps: ["submit", "confirm", "way", "progress", "finish"],
    text: "A predictable Oakville door adjustment with an eligible provider: availability is rechecked during simulated checkout. Approved quote, Paid payment and self-accepted assignment are created in the booking flow. Failed checkout preserves entry for retry.",
  },
  {
    id: "bundle",
    name: "Four-task bundle",
    steps: [
      "submit",
      "review",
      "fulfillment",
      "schedule",
      "confirm",
      "way",
      "progress",
      "finish",
    ],
    text: "Door, drywall, shelves and towel bar stay four independent tasks. One provider must fit the combined 240-minute duration. Splitting creates separate visits; it must not schedule the same task twice.",
  },
  {
    id: "delegate",
    name: "Delegated work",
    steps: [
      "submit",
      "review",
      "fulfillment",
      "schedule",
      "confirm",
      "way",
      "progress",
      "finish",
    ],
    text: "Operator chooses a contractor and sends one proposed visit. Acceptance, customer quote approval and applicable payment can happen in different orders; all requirements must pass before confirmation.",
  },
  {
    id: "restricted",
    name: "Restricted review",
    steps: ["submit", "review", "fulfillment"],
    text: "Electrical or ambiguous work remains Needs Review. Operator review and provider eligibility are required. Referral-only catalogue entries remain unbookable; they are recorded for referral review.",
  },
  {
    id: "decline",
    name: "Decline / reassign",
    steps: ["schedule", "fulfillment", "schedule", "confirm"],
    text: "A decline stays in assignment history and creates operator attention, even when a quote is pending. Reoffer manually or, when enabled, automatically to one eligible replacement at the same time/pay. Previous declines and expired candidates are excluded from automatic selection. Expiry remains manually actionable.",
  },
  {
    id: "partial",
    name: "Partial completion",
    steps: ["confirm", "way", "progress", "finish", "review"],
    text: "A contractor finishes with Materials required on one task. The visit ends, the task remains unresolved and the operator sees follow-up. There is no automatic return booking, extra charge or payout.",
  },
];
export const alternatives = [
  [
    "Information request",
    "Operator stores a question in request notes; customer can respond in the portal.",
    "Production gap",
    "The Waiting bucket recognizes an Information requested status, but the current action does not set it. Do not model this as a complete message/state workflow.",
  ],
  [
    "Decline / expiry",
    "Declines create structured alerts; expired offers are found through dispatch state. Replacement offers retain history.",
    "Implemented",
    "Automatic decline reoffers default off, preserve appointment/customer price/pay, and never auto-confirm. Expiry does not auto-reoffer.",
  ],
  [
    "Quote decline",
    "Customer declines a quote; the request remains subject to reconciliation.",
    "Implemented",
    "No dedicated negotiation workflow. A declined quote may still display Awaiting Quote Approval under current reconciliation.",
  ],
  [
    "Payment failure / retry",
    "Failed simulated transaction does not satisfy the Paid condition. Entry is preserved for retry.",
    "Simulated",
    "No payment processor, webhook, reconciliation with a bank or real refund.",
  ],
  [
    "Reschedule / cancel",
    "At least 24 hours before the appointment, existing self-service actions apply; inside that window, an operator change request is logged.",
    "Implemented",
    "Rescheduling rechecks options and may require a fresh offer. No real calendar synchronization. The 24-hour policy is adjustable demo policy.",
  ],
  [
    "Unresolved outcomes",
    "Finish records each outcome and flags operator follow-up.",
    "Implemented",
    "No automatic return visit, extra pricing, payment or payout. Dedicated follow-up resolution tooling is not complete.",
  ],
  [
    "Production integrations",
    "Browser-local records simulate coordination among roles in the same browser.",
    "Production gap",
    "Authentication, shared-device state, durable backend, real notifications, GPS tracking, provider payouts and review collection are not implemented.",
  ],
] as const;
export const queueRules =
  "History for completed/cancelled/declined requests; Draft separately. Unresolved visit issues and reassignment take precedence in Needs Action. Pending replacement offers and Awaiting statuses go to Waiting. Confirmed requests otherwise go to Scheduled. These are derived buckets, not additional Request.status values.";
