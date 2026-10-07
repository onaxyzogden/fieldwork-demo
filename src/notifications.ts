import {
  type Channel,
  type NotificationKind,
  type State,
  channelsFor,
  contacts,
  dateLabel,
  money,
  primaryContact,
  providers,
  sentence,
  timeLabel,
  uid,
  urgency,
} from "./model";
import {
  customerQuoteText,
  customerStatusText,
  customerVisitText,
} from "./customerText";

/**
 * Where a channel would actually reach someone.
 *
 * **Nothing is sent.** No SMS leaves this application and no email is
 * composed; this resolves the address a real integration would hand to a
 * provider, and returns nothing when there is none — which is what makes a
 * bounce a real state rather than one nobody can reach.
 */
export function addressFor(
  s: State,
  recipient: string,
  channel: Channel,
): string | undefined {
  if (channel === "in-app") return recipient;
  const [role, id] = recipient.split(":");
  const who =
    role === "Customer"
      ? primaryContact(id)
      : role === "Contractor"
        ? providers.find((p) => p.id === id)
        : // The operator is the business. Its owner's details stand in.
          providers.find((p) => p.id === "yousef");
  return channel === "sms" ? who?.phone : who?.email;
}

/**
 * The delivery rows for one notification, at the moment it is raised.
 *
 * In-app is `delivered` because it genuinely is — it is sitting in the inbox.
 * SMS and email stop at `sent` and never move, because without a provider
 * nothing reports back. That frozen `sent` is the honest shape of the gap: a
 * real integration turns it into delivered, bounced or a hard failure, and
 * until one exists nobody can say which.
 */
export function deliveriesFor(
  s: State,
  recipient: string,
  kind: NotificationKind,
  at: string,
) {
  return channelsFor(kind).map((channel) => {
    const address = addressFor(s, recipient, channel);
    return address
      ? {
          channel,
          state: channel === "in-app" ? ("delivered" as const) : ("sent" as const),
          at,
        }
      : {
          channel,
          state: "bounced" as const,
          at,
          reason: `No ${channel === "sms" ? "mobile number" : "email address"} on file`,
        };
  });
}
/**
 * How a request's new status reads in the operator's inbox (ADR 064): what
 * happened and to whom, rather than the record's own state name.
 */
export const operatorRequestText = (status: string, name: string) =>
  ({
    Submitted: `New request from ${name}`,
    "Needs Review": `${name}’s request needs review`,
    "Information requested": `Waiting on ${name}’s answer`,
    "Awaiting Quote Approval": `Quote sent to ${name}`,
    "Awaiting Payment": `${name} approved the quote`,
    "Awaiting Provider Acceptance": `Finding a contractor for ${name}`,
    Confirmed: `${name}’s booking is confirmed`,
    Completed: `${name}’s request is complete`,
  })[status] || `${name}’s request is ${status.toLowerCase()}`;

/**
 * An offer's new status, for the contractor and for the operator (ADR 064).
 * Nobody is told about what they just did themselves — a contractor's own
 * answer, the operator's own withdrawal — so those are absent. Declines and
 * expiries reach the operator as the reassignment alert, not as a notice.
 */
const offerText = (status: string, name: string, when: string) => ({
  contractor: (
    {
      Offered: `New job offer · ${when}`,
      Expired: `Offer expired · ${when}`,
      Reassigned: `Offer withdrawn · ${when}`,
      Cancelled: `Job cancelled · ${when}`,
    } as Record<string, string>
  )[status],
  operator: (
    {
      Offered: `Offer sent to ${name} · ${when}`,
      Accepted: `${name} accepted · ${when}`,
    } as Record<string, string>
  )[status],
});

/** What the customer is told when they cancel inside 24 hours (ADR 064). */
export const LATE_CANCEL_TEXT =
  "Your visit is cancelled. Because it was less than 24 hours away, a late-cancellation fee may apply. We’ll confirm.";
/** What the customer is told when they ask to change a visit inside 24 hours. */
export const callBackText = (by: string) =>
  sentence(
    `Your visit is less than 24 hours away, so we’ll arrange the new time with you. Expect a call by ${timeLabel(by)}`,
  );

export const inbox = (s: State, recipient: string) =>
  (s.notifications || []).filter(
    (n) => (n.recipient || "Operator") === recipient,
  );
export function deliverUpdates(before: State, after: State) {
  const emit = (
    recipient: string,
    requestId: string,
    visitId: string,
    assignmentId: string,
    kind: string,
    text: string,
    read = false,
  ) => {
    const at = new Date(after.clock).toISOString();
    (after.notifications ??= []).unshift({
      id: uid(),
      recipient,
      requestId,
      visitId,
      assignmentId,
      kind,
      text,
      at,
      read,
      deliveries: deliveriesFor(after, recipient, kind as NotificationKind, at),
    });
  };
  for (const r of after.requests) {
    const old = before.requests.find((x) => x.id === r.id);
    /* Keyed off the field the operator actually writes. The old key was
       r.notes, which nothing has written since the Q&A slot was introduced. */
    if (old && old.operatorNote !== r.operatorNote && r.operatorNote) {
      for (const recipient of ["Operator", "Customer:" + r.accountId])
        emit(
          recipient,
          r.id,
          "",
          "",
          "information",
          recipient === "Operator"
            ? `Information requested: ${r.operatorNote}`
            : `We have a question: ${r.operatorNote}`,
        );
    }
    if (old && old.customerReply !== r.customerReply && r.customerReply) {
      emit(
        "Operator",
        r.id,
        "",
        "",
        "information",
        `${r.name} answered: ${r.customerReply}`,
      );
    }
    /* A late cancellation says so, and what happens to the money, rather
       than the plain "Cancelled" (ADR 064). */
    const late = !!r.lateCancel && !old?.lateCancel;
    if (r.status !== "Draft" && old?.status !== r.status) {
      emit(
        "Operator",
        r.id,
        "",
        "",
        "request",
        late
          ? `${r.name} cancelled within 24 hours · decide the late fee`
          : operatorRequestText(r.status, r.name),
      );
      emit(
        "Customer:" + r.accountId,
        r.id,
        "",
        "",
        "request",
        late
          ? LATE_CANCEL_TEXT
          : `Your request: ${customerStatusText(r.status)}`,
      );
    }
    const fee = r.lateCancel?.fee;
    if (fee !== undefined && old?.lateCancel?.fee === undefined)
      emit(
        "Customer:" + r.accountId,
        r.id,
        "",
        "",
        "request",
        fee
          ? `Late-cancellation fee: ${money(fee)}. Anything else you paid has been refunded.`
          : "No late-cancellation fee. Anything you paid has been refunded in full.",
      );
    if (r.callBack && r.callBack.by !== old?.callBack?.by) {
      emit(
        "Operator",
        r.id,
        r.callBack.visitId,
        "",
        "request",
        `Call ${r.name} by ${timeLabel(r.callBack.by)} to reschedule`,
      );
      emit(
        "Customer:" + r.accountId,
        r.id,
        r.callBack.visitId,
        "",
        "request",
        callBackText(r.callBack.by),
      );
    }
  }
  for (const a of after.assignments) {
    const old = before.assignments.find((x) => x.id === a.id);
    if (old?.status === a.status) continue;
    const v = after.visits.find((v) => v.id === a.visitId);
    if (!v) continue;
    const text = offerText(
      a.status,
      providers.find((p) => p.id === a.providerId)?.name || a.providerId,
      dateLabel(v.start),
    );
    /* Moving a visit withdraws the accepted offer and makes a new one to the
       same contractor in the same change; "New job offer" says it,
       "withdrawn" would not. */
    const renewed =
      a.status === "Reassigned" &&
      after.assignments.some(
        (x) =>
          x.visitId === a.visitId &&
          x.providerId === a.providerId &&
          !before.assignments.some((b) => b.id === x.id),
      );
    if (text.contractor && !renewed)
      emit(
        "Contractor:" + a.providerId,
        v.requestId,
        v.id,
        a.id,
        "offer",
        text.contractor,
      );
    if (text.operator)
      emit("Operator", v.requestId, v.id, a.id, "offer", text.operator);
  }
  /* Additional charges and closed tasks (ADR 065): the customer hears what
     they are asked to pay or have had back, the operator what they said. */
  for (const c of after.charges ?? []) {
    const old = before.charges?.find((x) => x.id === c.id);
    const r = after.requests.find((x) => x.id === c.requestId);
    if (!r || old?.status === c.status) continue;
    if (c.status === "Sent")
      emit(
        "Customer:" + r.accountId,
        r.id,
        "",
        "",
        "quote",
        `Additional charge to approve · ${money(c.amount)} · ${c.reason}`,
      );
    else
      emit(
        "Operator",
        r.id,
        c.visitId ?? "",
        "",
        "quote",
        `${r.name} ${c.status === "Approved" ? "approved" : "declined"} the ${money(c.amount)} charge`,
      );
  }
  for (const v of after.visits) {
    const r = after.requests.find((x) => x.id === v.requestId);
    const was = before.visits.find((x) => x.id === v.id)?.execution?.outcomes;
    for (const [taskId, o] of Object.entries(v.execution?.outcomes ?? {})) {
      const closed = o.resolution?.kind === "Closed" ? o.resolution : null;
      if (!r || !closed || was?.[taskId]?.resolution) continue;
      const task = after.tasks.find((t) => t.id === taskId)?.summary;
      emit(
        "Customer:" + r.accountId,
        r.id,
        v.id,
        "",
        "payment",
        `We’ve closed “${task}” without doing it${closed.refund ? ` and refunded ${money(closed.refund)}` : ""}.`,
      );
    }
  }
  for (const v of after.visits) {
    const old = before.visits.find((x) => x.id === v.id),
      r = after.requests.find((r) => r.id === v.requestId);
    if (!r) continue;
    const targets = [
      "Operator",
      "Customer:" + r.accountId,
      ...(v.providerId === "yousef" ? [] : ["Contractor:" + v.providerId]),
    ];
    /* Each change in the operator's, the contractor's and the customer's
       words (ADR 061, ADR 064): the operator needs whose visit it is. */
    const changes: [operator: string, contractor: string, customer: string][] =
      [];
    const when = dateLabel(v.start);
    if (old && old.start !== v.start)
      changes.push([
        `${r.name}’s visit moved to ${when}`,
        `Visit moved to ${when}`,
        `Appointment changed to ${when}`,
      ]);
    if (old?.status !== v.status) {
      const status = v.status.toLowerCase();
      changes.push([
        `Visit ${status} for ${r.name} · ${when}`,
        `Visit ${status} · ${when}`,
        `Visit ${customerVisitText(v.status).toLowerCase()} · ${when}`,
      ]);
    }
    if (v.execution?.onWayAt && !old?.execution?.onWayAt) {
      const eta = dateLabel(v.execution.eta || v.start);
      changes.push([
        `${providers.find((p) => p.id === v.providerId)?.name || "The contractor"} is on the way · arriving around ${eta}`,
        `You’re on the way · arriving around ${eta}`,
        `Your provider is on the way · arriving around ${eta}`,
      ]);
    }
    for (const [operator, contractor, customer] of changes)
      for (const recipient of targets)
        emit(
          recipient,
          r.id,
          v.id,
          "",
          "visit",
          recipient.startsWith("Customer:")
            ? customer
            : recipient === "Operator"
              ? operator
              : contractor,
        );
    for (const m of v.messages || []) {
      if (old?.messages?.some((x) => x.id === m.id)) continue;
      const sender = m.sender.startsWith("Customer:")
        ? r.name
        : m.sender === "Operator"
          ? "Operator"
          : providers.find((p) => p.id === m.sender)?.name || m.sender;
      for (const recipient of targets)
        emit(
          recipient,
          r.id,
          v.id,
          "",
          "message",
          // The business, not its back-office role, to the customer.
          `${recipient.startsWith("Customer:") && sender === "Operator" ? "fieldwork" : sender}: ${m.text}`,
          recipient ===
            (m.sender === "Operator" || m.sender.startsWith("Customer:")
              ? m.sender
              : "Contractor:" + m.sender),
        );
    }
  }
  for (const q of after.quotes) {
    if (
      before.quotes.find((x) => x.id === q.id)?.status === q.status ||
      q.status === "Superseded"
    )
      continue;
    const r = after.requests.find((r) => r.id === q.requestId);
    if (!r) continue;
    for (const recipient of ["Operator", "Customer:" + r.accountId])
      emit(
        recipient,
        r.id,
        "",
        "",
        "quote",
        recipient === "Operator"
          ? `Quote ${q.status.toLowerCase()} · ${r.address}`
          : q.status === "Sent"
            ? `Your quote is ready · ${r.address}`
            : `Quote ${customerQuoteText(q.status).toLowerCase()} · ${r.address}`,
      );
  }
  for (const p of after.payments) {
    if (before.payments.find((x) => x.id === p.id)?.status === p.status)
      continue;
    const q = after.quotes.find((q) => q.id === p.quoteId),
      r = after.requests.find((r) => r.id === q?.requestId);
    if (!r) continue;
    for (const recipient of ["Operator", "Customer:" + r.accountId])
      emit(
        recipient,
        r.id,
        "",
        "",
        "payment",
        recipient === "Operator"
          ? `Simulated payment ${p.status.toLowerCase()} · ${r.address}`
          : p.status === "Paid"
            ? `Payment received · ${r.address}`
            : p.status === "Failed"
              ? `Your payment didn’t go through · ${r.address}`
              : `Payment ${p.status.toLowerCase()} · ${r.address}`,
      );
  }
}
export function sendMessage(
  s: State,
  visitId: string,
  sender: string,
  text: string,
) {
  const v = s.visits.find((v) => v.id === visitId),
    r = s.requests.find((r) => r.id === v?.requestId);
  if (!v || !r || v.status === "Cancelled" || !text.trim()) return false;
  if (
    sender !== "Operator" &&
    sender !== "Customer:" + r.accountId &&
    !(
      sender === v.providerId &&
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === sender &&
          a.status === "Accepted",
      )
    )
  )
    return false;
  (v.messages ??= []).push({
    id: uid(),
    sender,
    text: text.trim(),
    at: new Date(s.clock).toISOString(),
  });
  return true;
}

/**
 * Time-sensitive notifications nobody has opened.
 *
 * This is the question the audits actually asked — "has the contractor seen
 * the offer?" — and the one the operator could not ask before, because an
 * offer expiring unseen looked identical to one being ignored.
 */
export const unseen = (s: State) =>
  (s.notifications ?? []).filter(
    (n) =>
      !n.read && urgency[n.kind as NotificationKind] === "time-sensitive",
  );

/** Notifications with a channel that could not even be attempted. */
export const bounced = (s: State) =>
  (s.notifications ?? []).filter((n) =>
    (n.deliveries ?? []).some((d) => d.state === "bounced"),
  );

/** Opening a notification is the one delivery transition this app can observe. */
export function markRead(s: State, id: string) {
  const n = (s.notifications ?? []).find((x) => x.id === id);
  if (!n || n.read) return false;
  n.read = true;
  const inApp = (n.deliveries ?? []).find((d) => d.channel === "in-app");
  if (inApp) {
    inApp.state = "read";
    inApp.at = new Date(s.clock).toISOString();
  }
  return true;
}

/** How a delivery row reads to a person. */
export const deliveryLabel = (d: {
  channel: Channel;
  state: string;
  reason?: string;
}) =>
  d.state === "bounced"
    ? `${d.channel.toUpperCase()} · ${d.reason}`
    : `${d.channel === "in-app" ? "In-app" : d.channel.toUpperCase()} · ${d.state}`;

/** The contractor's own copy of an offer: the one notice that says whether
 *  they have seen it. The first raised, since later ones record the answer. */
const offerNotice = (s: State, assignmentId: string) => {
  const a = s.assignments.find((x) => x.id === assignmentId);
  return (s.notifications ?? [])
    .filter(
      (n) =>
        a &&
        n.assignmentId === a.id &&
        n.kind === "offer" &&
        n.recipient === "Contractor:" + a.providerId,
    )
    .at(-1);
};

/**
 * "Has the contractor seen the offer?" (ADR 045), as the operator reads it on
 * a waiting offer (ADR 060): when it went, and when it was opened, if it was.
 */
export function offerSeen(s: State, assignmentId: string) {
  const n = offerNotice(s, assignmentId);
  if (!n) return undefined;
  const inApp = (n.deliveries ?? []).find((d) => d.channel === "in-app");
  return {
    sentAt: n.at,
    openedAt: n.read ? inApp?.at || n.at : undefined,
  };
}

/** Opening the offer on Your Work is seeing it, as much as opening the bell. */
export const markOfferSeen = (s: State, assignmentId: string) => {
  const n = offerNotice(s, assignmentId);
  return n ? markRead(s, n.id) : false;
};

/**
 * Who on a request could not be reached, and how: one entry per person and
 * channel, by name. A bounce is the one delivery state the operator can act
 * on — by reaching that person some other way.
 */
export function unreachable(s: State, requestId: string) {
  const out: { name: string; channel: Channel; reason: string }[] = [];
  for (const n of bounced(s)) {
    if (n.requestId !== requestId) continue;
    const [role, id] = (n.recipient || "Operator").split(":");
    const name =
      role === "Customer"
        ? primaryContact(id)?.name
        : role === "Contractor"
          ? providers.find((p) => p.id === id)?.name
          : undefined;
    // The operator's own copies are not someone the operator has to reach.
    if (!name) continue;
    for (const d of n.deliveries ?? [])
      if (
        d.state === "bounced" &&
        !out.some((o) => o.name === name && o.channel === d.channel)
      )
        out.push({ name, channel: d.channel, reason: d.reason || "" });
  }
  return out;
}
