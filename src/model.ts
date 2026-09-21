import { getIssue, needsClarificationReview } from "./clarification";
export type Task = {
  entryStage?: "description" | "details" | "done";
  issueId?: string;
  id: string;
  requestId: string;
  description: string;
  summary: string;
  category: string;
  duration: number;
  confidence: number;
  reason: string;
  restricted: boolean;
  reviewed: boolean;
  photos: string[];
  answers: Record<string, string>;
  mergedInto?: string;
  status?: string;
};
export type Request = {
  intakeScreen?: "address" | "tasks" | "booking";
  editingTaskId?: string | null;
  /** A slot the customer actually selected. A commitment, unlike preferredSlots. */
  preferredSlot?: {
    start: string;
    providerId: string;
    duration: number;
    signature: string;
  };
  /**
   * Scheduling preference stated at intake — days the customer would like, and
   * which parts of those days. Deliberately independent of preferredSlot: this
   * is a wish, not a booking, and is never rendered as one.
   */
  preferredSlots?: { date: string; times: string[] }[];
  /** Free text from the same intake step, e.g. "baby naps 3–4pm". */
  timingConstraints?: string;
  /**
   * The operator's single outstanding question and the customer's single reply.
   * One slot, not a thread: asking again overwrites the pair. If real
   * back-and-forth is ever needed that is a decision to adopt chat, not to grow
   * this into a message list.
   */
  operatorNote?: string | null;
  customerReply?: string | null;
  id: string;
  customerId: string;
  name: string;
  address: string;
  city: string;
  status: string;
  mode: string;
  timing: string;
  notes: string;
  postalCode?: string;
  unit?: string;
  deadline?: string;
};
export type Visit = {
  execution?: {
    onWayAt?: string;
    eta?: string;
    startedAt?: string;
    finishedAt?: string;
    outcomes: Record<
      string,
      { outcome: string; note: string; before: string[]; after: string[] }
    >;
  };
  messages?: { id: string; sender: string; text: string; at: string }[];
  id: string;
  requestId: string;
  taskIds: string[];
  providerId: string;
  start: string;
  duration: number;
  status: string;
  travel: number;
};
export type Assignment = {
  declineReason?: string;
  id: string;
  visitId: string;
  providerId: string;
  status: string;
  pay: number;
  expiresAt: number;
};
export type Quote = {
  id: string;
  requestId: string;
  type: string;
  amount: number;
  high: number;
  status: string;
  notes: string;
  payOnCompletion: boolean;
};
export type Payment = {
  id: string;
  quoteId: string;
  status: string;
  amount: number;
  reference: string;
};
export type State = {
  settings?: { autoReofferDeclined: boolean };
  notifications?: {
    recipient?: string;
    id: string;
    assignmentId: string;
    visitId: string;
    requestId: string;
    kind: string;
    text: string;
    at: string;
    read: boolean;
  }[];
  requests: Request[];
  tasks: Task[];
  visits: Visit[];
  assignments: Assignment[];
  quotes: Quote[];
  payments: Payment[];
  events: { id: string; text: string; at: string }[];
  clock: number;
};
/**
 * The customer roster. An explicit list, not a set derived from existing
 * requests: identity is a real foreign key, so a customer exists whether or not
 * they currently have a request, and no request can belong to nobody.
 */
export const customers = [
  { id: "c1", name: "Sarah Lin" },
  { id: "c2", name: "Daniel Brooks" },
  { id: "c3", name: "Priya Nair" },
  { id: "c4", name: "James Carter" },
  { id: "c5", name: "Amir Hassan" },
];
export const customerName = (id: string) =>
  customers.find((c) => c.id === id)?.name || "Unknown customer";
export const providers = [
  {
    id: "yousef",
    name: "Yousef Haddad",
    initials: "YH",
    role: "Owner · Lead handyman",
    city: "Oakville",
    rate: 65,
    skills: "Doors, walls, installation, assembly",
    eligible: false,
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    initials: "MC",
    role: "Trusted contractor",
    city: "Burlington",
    rate: 55,
    skills: "Assembly, installation, doors",
    eligible: false,
  },
  {
    id: "nina",
    name: "Nina Patel",
    initials: "NP",
    role: "Trusted contractor",
    city: "Oakville",
    rate: 60,
    skills: "Assembly, walls, installation, doors",
    eligible: false,
  },
  {
    id: "eli",
    name: "Elias Williams",
    initials: "EW",
    role: "Specialist · operator marked eligible",
    city: "Milton",
    rate: 95,
    skills: "Electrical, restricted work",
    eligible: true,
  },
];
export const uid = () => Math.random().toString(36).slice(2, 10);
export const money = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (s: string) =>
  new Date(s).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export function classify(description: string) {
  const t = description.toLowerCase().replace(/[’]/g, "'");
  const restricted =
    /\b(electrical|wiring|breaker|circuit|outlet|light fixture|ceiling fan|rough.in|load.bearing|structural)\b/.test(
      t,
    ) ||
    (/\bswitch\b/.test(t) && !t.includes("switch out furniture"));
  const rules: [RegExp, string, string, number, string][] = [
    [
      /\bdoor\b.*(rub|stick|close|latch)|(rub|stick).*\bdoor\b/,
      "Handyman / Doors / Adjustment",
      "Door adjustment",
      60,
      "DOOR-01 · door + rubbing / sticking / latch",
    ],
    [
      /drywall|hole in (the )?wall/,
      "Handyman / Walls / Drywall",
      "Drywall patch",
      75,
      "WALL-01 · drywall / hole in wall",
    ],
    [
      /shel(f|ves|ving)/,
      "Installation / Shelving",
      "Shelf installation",
      75,
      "INSTALL-01 · shelf / shelves",
    ],
    [
      /towel (bar|rack)/,
      "Handyman / Fixtures / Minor repair",
      "Towel-bar repair",
      30,
      "FIX-01 · towel bar",
    ],
    [
      /\btv\b|television/,
      "Installation / TV mount",
      "TV mounting",
      90,
      "INSTALL-02 · TV / television",
    ],
    [
      /assembl|ikea|wardrobe|furniture/,
      "Assembly / Furniture",
      "Furniture assembly",
      120,
      "ASSEMBLY-01 · assembly / furniture",
    ],
    [
      /faucet|leak under sink|sink leaking/,
      "Plumbing / Fixture",
      "Fixture leak investigation",
      90,
      "PLUMB-01 · faucet / leak under sink",
    ],
    [
      /deck|fence|gate/,
      "Exterior / Deck and fence",
      "Exterior repair",
      120,
      "EXT-01 · deck / fence / gate",
    ],
  ];
  if (restricted)
    return {
      summary: "Electrical / restricted work review",
      category: "Electrical / Restricted work",
      duration: 90,
      confidence: 1,
      reason: "SAFE-01 · restricted phrase overrides ordinary matches",
      restricted: true,
      reviewed: false,
    };
  const intakeIssue = getIssue(description);
  if (intakeIssue.id !== "unknown" && intakeIssue.review)
    return {
      issueId: intakeIssue.id,
      summary: intakeIssue.title,
      category: `${intakeIssue.category || "Specialist"} / ${intakeIssue.title}`,
      duration: 90,
      confidence: 0.9,
      reason: `INTAKE · ${intakeIssue.title} · operator scope review required`,
      restricted: intakeIssue.category === "Electrical",
      reviewed: false,
    };
  const candidates = rules
    .map((rule, index) => {
      const match = t.match(rule[0]);
      const topic = rule[2].split(" ")[0].toLowerCase();
      const excluded = new RegExp(
        `(?:no|not|without)\\s+(?:a\\s+)?${topic}\\s+(?:problem|issue|repair|work)`,
      ).test(t);
      const combination =
        /\b(install|repair|patch|fix|assemble|mount|rubbing|sticking|leak|broken|loose)\b/.test(
          t,
        );
      const weight =
        match && !excluded
          ? 0.82 +
            (combination ? 0.12 : 0) +
            (match[0].includes(" ") ? 0.03 : 0)
          : 0;
      return { rule, weight, index, excluded };
    })
    .filter((x) => x.weight >= 0.8)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const best = candidates[0];
  return best
    ? {
        summary: best.rule[2],
        category: best.rule[1],
        duration: best.rule[3],
        confidence: Math.min(0.99, best.weight),
        reason:
          best.rule[4] +
          ` · weighted score ${Math.round(best.weight * 100)} / 100`,
        restricted: false,
        reviewed: true,
      }
    : intakeIssue.id !== "unknown"
      ? {
          summary: intakeIssue.title,
          category: `${intakeIssue.category || "Handyman"} / ${intakeIssue.title}`,
          duration: 90,
          confidence: 0.85,
          reason: `CATALOGUE · ${intakeIssue.id} · scope and duration require review`,
          restricted: intakeIssue.category === "Electrical",
          reviewed: false,
          issueId: intakeIssue.id,
        }
      : {
          summary: "Tell us a little more",
          category: "Needs Review",
          duration: 60,
          confidence: 0.25,
          reason: "No phrase combination cleared confidence threshold (0.80)",
          restricted: false,
          reviewed: false,
        };
}
export function seed(): State {
  const clock = Date.now();
  const requests: Request[] = [
    [
      "r1",
      "c1",
      "Sarah Lin",
      "124 Maple Grove Drive",
      "Oakville",
      "Draft",
      "Instant Book",
    ],
    [
      "r2",
      "c2",
      "Daniel Brooks",
      "38 Lakeshore Road West",
      "Oakville",
      "Submitted",
      "Request to Book",
    ],
    [
      "r3",
      "c3",
      "Priya Nair",
      "215 New Street",
      "Burlington",
      "Submitted",
      "Request to Book",
    ],
    [
      "r4",
      "c4",
      "James Carter",
      "62 Thompson Road",
      "Milton",
      "Needs Review",
      "Request to Book",
    ],
    [
      "r5",
      "c5",
      "Amir Hassan",
      "90 Rebecca Street",
      "Oakville",
      "Awaiting Provider Acceptance",
      "Request to Book",
    ],
  ].map((a) => ({
    id: a[0],
    customerId: a[1],
    name: a[2],
    address: a[3],
    city: a[4],
    status: a[5],
    mode: a[6],
    timing: "Weekdays · 9 AM–5 PM · Flexible",
    notes: "",
    preferredSlots: [],
    timingConstraints: "",
    operatorNote: null,
    customerReply: null,
  }));
  // One seeded request carries a stated preference so the operator queue and the
  // customer's own view both exercise it without needing a fresh intake run.
  const withPreference = requests.find((r) => r.id === "r3");
  if (withPreference) {
    const day = torontoParts(new Date(clock + 3 * 86400000));
    withPreference.preferredSlots = [
      {
        date: `${day.year}-${day.month}-${day.day}`,
        times: ["Morning", "Afternoon"],
      },
    ];
    withPreference.timingConstraints =
      "Baby is napping from 3–4pm. Please do not arrive during those times.";
  }
  const ds = [
    [
      "r1",
      "My bedroom door is rubbing against the frame and won’t close properly.",
    ],
    ["r2", "Bedroom door sticking against the frame"],
    ["r2", "Patch a small drywall hole"],
    ["r2", "Install two shelves in the office"],
    ["r2", "Fix a loose towel bar"],
    ["r3", "Assemble an IKEA wardrobe and chest of drawers"],
    ["r4", "Replace electrical wiring and check a breaker that keeps tripping"],
    ["r5", "Mount a 55-inch TV on the living room wall"],
  ];
  const tasks = ds.map((a, i) => ({
    id: "t" + i,
    requestId: a[0],
    description: a[1],
    ...classify(a[1]),
    photos: [],
    answers: {},
  }));
  const start = new Date(clock + 3 * 86400000);
  start.setHours(10, 0, 0, 0);
  return {
    requests,
    tasks,
    visits: [
      {
        id: "v5",
        requestId: "r5",
        taskIds: ["t7"],
        providerId: "marcus",
        start: start.toISOString(),
        duration: 90,
        status: "Proposed",
        travel: 12,
      },
    ],
    assignments: [
      {
        id: "a5",
        visitId: "v5",
        providerId: "marcus",
        status: "Offered",
        pay: 110,
        expiresAt: clock + 7200000,
      },
    ],
    quotes: [],
    payments: [],
    events: [
      {
        id: uid(),
        text: "Demo ready · five sample requests loaded",
        at: new Date(clock).toISOString(),
      },
    ],
    clock,
  };
}
/**
 * Derived customer-facing state. Computed, never stored.
 *
 * A decline reverts `coordinated` to false, and that is exactly what hides the
 * decline from the customer: their view falls back to the ordinary "still
 * matching" state, as if nothing had happened. Reassignment is the operator's
 * problem to solve invisibly, so nothing downstream of this may surface a
 * declined assignment to the customer.
 */
export function coordinated(s: State, requestId: string) {
  return s.visits
    .filter((v) => v.requestId === requestId && v.status !== "Cancelled")
    .some((v) =>
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === v.providerId &&
          !["Declined", "Expired"].includes(a.status),
      ),
    );
}
/** A quote is only customer-visible once the request is genuinely coordinated. */
export function quoted(s: State, requestId: string) {
  const q = s.quotes.find(
    (q) => q.requestId === requestId && q.status !== "Superseded",
  );
  return !!q && q.amount > 0 && coordinated(s, requestId);
}
/**
 * Three-way AND, not two. Approval and acceptance are not enough: a visit is not
 * confirmed until a time actually exists for it.
 */
export function confirmed(s: State, requestId: string) {
  const q = s.quotes.find(
    (q) => q.requestId === requestId && q.status !== "Superseded",
  );
  const accepted = s.visits
    .filter((v) => v.requestId === requestId && v.status !== "Cancelled")
    .some(
      (v) =>
        !!v.start &&
        s.assignments.some(
          (a) =>
            a.visitId === v.id &&
            a.providerId === v.providerId &&
            a.status === "Accepted",
        ),
    );
  return q?.status === "Approved" && accepted;
}
export function log(s: State, text: string) {
  s.events.unshift({ id: uid(), text, at: new Date(s.clock).toISOString() });
}
export function reconcile(s: State) {
  for (const a of s.assignments)
    if (a.status === "Offered" && a.expiresAt <= s.clock) {
      a.status = "Expired";
      log(s, "Contractor offer expired · reassignment required");
    }
  for (const r of s.requests) {
    if (["Draft", "Cancelled", "Declined", "Completed"].includes(r.status))
      continue;
    /* An unanswered operator question is a waiting state in its own right.
       The Waiting bucket has always recognized it; until now nothing set it,
       so "Need More Info" left the request sitting in Needs Action. */
    const asked = !!r.operatorNote && !r.customerReply;
    const tasks = s.tasks.filter((t) => t.requestId === r.id && !t.mergedInto);
    if (tasks.some((t) => !t.reviewed)) {
      r.status = asked ? "Information requested" : "Needs Review";
      continue;
    }
    const vs = s.visits.filter(
      (v) => v.requestId === r.id && v.status !== "Cancelled",
    );
    const q = s.quotes.find(
      (q) => q.requestId === r.id && q.status !== "Superseded",
    );
    const accepted = (v: Visit) =>
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === v.providerId &&
          a.status === "Accepted",
      );
    const allAssigned = tasks.every((t) =>
      vs.some((v) => v.taskIds.includes(t.id)),
    );
    const ready =
      vs.length > 0 &&
      allAssigned &&
      vs.every(
        (v) =>
          accepted(v) &&
          eligible(
            v.providerId,
            tasks.filter((t) => v.taskIds.includes(t.id)),
          ),
      ) &&
      q?.status === "Approved" &&
      (q.payOnCompletion ||
        s.payments.some((p) => p.quoteId === q.id && p.status === "Paid"));
    r.status = ready
      ? "Confirmed"
      : q && q.status !== "Approved"
        ? "Awaiting Quote Approval"
        : vs.length && !vs.every(accepted)
          ? "Awaiting Provider Acceptance"
          : q?.status === "Approved" &&
              !q.payOnCompletion &&
              !s.payments.some((p) => p.quoteId === q.id && p.status === "Paid")
            ? "Awaiting Payment"
            : asked
              ? "Information requested"
              : "Submitted";
    for (const v of vs)
      if (!["In Progress", "Completed"].includes(v.status))
        v.status = ready ? "Confirmed" : "Proposed";
    for (const t of tasks) {
      const completed = vs.some(
        (v) =>
          v.execution?.finishedAt &&
          v.execution.outcomes[t.id]?.outcome === "Completed",
      );
      t.status = completed
        ? "Completed"
        : vs.some((v) => v.taskIds.includes(t.id))
          ? "assigned to visit"
          : "unassigned";
    }
    if (
      vs.length &&
      vs.every((v) => v.status === "Completed") &&
      tasks.every((t) => t.status === "Completed")
    )
      r.status = "Completed";
  }
}
export function torontoParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}
export function localTime(day: string, hour: number) {
  let d = new Date(day + "T12:00:00Z");
  const p = torontoParts(d);
  return new Date(+d + (hour - Number(p.hour)) * 3600000);
}
export function available(
  s: State,
  providerId: string,
  duration: number,
  city: string,
  start: string,
  exclude?: string,
  timing = "",
) {
  const d = new Date(start),
    p = torontoParts(d);
  const mins = Number(p.hour) * 60 + Number(p.minute);
  const travel =
    providers.find((p) => p.id === providerId)?.city === city ? 8 : 24;
  if (
    !Number.isFinite(+d) ||
    +d <= s.clock ||
    !providerId ||
    duration < 15 ||
    ["Sat", "Sun"].includes(p.weekday) ||
    mins - travel < 9 * 60 ||
    mins + duration + 15 > 17 * 60
  )
    return false;
  if (timing.includes("9 AM–12 PM") && mins + duration > 12 * 60) return false;
  if (timing.includes("1–5 PM") && mins < 13 * 60) return false;
  return !s.visits.some(
    (v) =>
      v.id !== exclude &&
      v.providerId === providerId &&
      v.status !== "Cancelled" &&
      +d - travel * 60000 < +new Date(v.start) + (v.duration + 15) * 60000 &&
      +d + (duration + 15 + travel) * 60000 > +new Date(v.start),
  );
}
export function slots(
  s: State,
  providerId: string,
  duration: number,
  city: string,
  exclude?: string,
  timing = "",
  limit = 3,
) {
  if (!providerId) return [];
  const out: { start: string; travel: number; score: number }[] = [];
  const base = new Date(s.clock + 2 * 86400000);
  for (let day = 0; day < 10; day++) {
    const p = torontoParts(new Date(+base + day * 86400000));
    for (const h of [10, 11, 13, 15]) {
      const d = localTime(`${p.year}-${p.month}-${p.day}`, h);
      const travel =
        providers.find((p) => p.id === providerId)?.city === city ? 8 : 24;
      if (
        available(
          s,
          providerId,
          duration,
          city,
          d.toISOString(),
          exclude,
          timing,
        )
      )
        out.push({
          start: d.toISOString(),
          travel,
          score: 100 - travel - day * 2 - (h === 11 ? 0 : 4),
        });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
export function scopeMatch(providerId: string, tasks: Task[]) {
  const p = providers.find((p) => p.id === providerId);
  const active = tasks.filter((t) => !t.mergedInto);
  const checks = active.map((t) => {
    const referral = getIssue(t.description).availability === "Referral only";
    const family = t.category.split(" / ")[0].toLowerCase();
    const matchedSkill = !p
      ? ""
      : p.skills.toLowerCase().includes(family)
        ? family
        : t.category.includes("Doors") && p.skills.includes("doors")
          ? "doors"
          : t.category.includes("Walls") && p.skills.includes("walls")
            ? "walls"
            : t.category.includes("Fixtures") &&
                p.skills.includes("installation")
              ? "installation"
              : "";
    const skill =
      !!p && (t.restricted || providerId === "yousef" || !!matchedSkill);
    const qualified = !!p && (!t.restricted || p.eligible);
    const fits = !referral && t.reviewed && qualified && skill;
    const reason = referral
      ? "Referral-only work is not bookable"
      : !t.reviewed
        ? "Operator scope review required"
        : !qualified
          ? "Restricted-work eligibility required"
          : !skill
            ? "Required skill not listed for this provider"
            : t.restricted
              ? "Operator-reviewed scope and manually marked specialist eligibility"
              : providerId === "yousef"
                ? "Covered by the existing owner/lead-handyman eligibility policy"
                : `Listed ${matchedSkill} skill matches this task; operator scope review is complete`;
    return {
      taskId: t.id,
      title: t.summary,
      category: t.category,
      fits,
      reason,
    };
  });
  return {
    eligible: !!p && checks.length > 0 && checks.every((c) => c.fits),
    checks,
  };
}
export function eligible(providerId: string, tasks: Task[]) {
  return scopeMatch(providerId, tasks).eligible;
}
export function instantEligible(tasks: Task[]) {
  return (
    tasks.length === 1 &&
    tasks[0].category.includes("Doors") &&
    tasks[0].reviewed &&
    !needsClarificationReview(tasks[0]) &&
    (!tasks[0].answers["door-adjust:count"] ||
      /^(1|one)( door)?$/i.test(
        tasks[0].answers["door-adjust:count"].trim(),
      )) &&
    tasks[0].answers["door-adjust:location"] !== "Exterior" &&
    !tasks[0].restricted &&
    !/damaged|broken|replace|rott|crack|fire.rated/i.test(
      tasks[0].description + " " + Object.values(tasks[0].answers).join(" "),
    )
  );
}
