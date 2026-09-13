import { type State, uid, dateLabel, providers } from "./model";
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
    (after.notifications ??= []).unshift({
      id: uid(),
      recipient,
      requestId,
      visitId,
      assignmentId,
      kind,
      text,
      at: new Date(after.clock).toISOString(),
      read,
    });
  };
  for (const r of after.requests) {
    const old = before.requests.find((x) => x.id === r.id);
    if (
      old &&
      old.notes !== r.notes &&
      r.notes.startsWith("Information requested:")
    ) {
      for (const recipient of ["Operator", "Customer:" + r.customerId])
        emit(recipient, r.id, "", "", "information", r.notes);
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
        "Customer:" + r.customerId,
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
      "Customer:" + r.customerId,
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
    for (const recipient of ["Operator", "Customer:" + r.customerId])
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
    for (const recipient of ["Operator", "Customer:" + r.customerId])
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
    sender !== "Customer:" + r.customerId &&
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
