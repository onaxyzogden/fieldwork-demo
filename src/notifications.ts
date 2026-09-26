import {
  type Channel,
  type NotificationKind,
  type State,
  channelsFor,
  contacts,
  dateLabel,
  primaryContact,
  providers,
  uid,
  urgency,
} from "./model";

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
          `Information requested: ${r.operatorNote}`,
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
    if (r.status !== "Draft" && old?.status !== r.status) {
      emit(
        "Operator",
        r.id,
        "",
        "",
        "request",
        `${r.name}: request ${r.status.toLowerCase()}`,
      );
      emit(
        "Customer:" + r.accountId,
        r.id,
        "",
        "",
        "request",
        `Your request: ${r.status}`,
      );
    }
  }
  for (const a of after.assignments) {
    const old = before.assignments.find((x) => x.id === a.id);
    if (old?.status === a.status) continue;
    const v = after.visits.find((v) => v.id === a.visitId);
    if (!v) continue;
    const text = `${providers.find((p) => p.id === a.providerId)?.name || a.providerId}: offer ${a.status.toLowerCase()} · ${dateLabel(v.start)}`;
    emit("Contractor:" + a.providerId, v.requestId, v.id, a.id, "offer", text);
    if (!["Declined", "Expired"].includes(a.status))
      emit("Operator", v.requestId, v.id, a.id, "offer", text);
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
    const changes: string[] = [];
    if (old && old.start !== v.start)
      changes.push(`Appointment changed to ${dateLabel(v.start)}`);
    if (old?.status !== v.status)
      changes.push(`Visit ${v.status.toLowerCase()} · ${dateLabel(v.start)}`);
    if (v.execution?.onWayAt && !old?.execution?.onWayAt)
      changes.push(
        `Provider is on the way · simulated ETA ${dateLabel(v.execution.eta || v.start)}`,
      );
    for (const text of changes)
      for (const recipient of targets)
        emit(recipient, r.id, v.id, "", "visit", text);
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
          `${sender}: ${m.text}`,
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
        `Quote ${q.status.toLowerCase()} · ${r.address}`,
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
        `Simulated payment ${p.status.toLowerCase()} · ${r.address}`,
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
