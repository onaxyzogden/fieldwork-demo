import {
  AUTHORIZE_WITHIN_DAYS,
  log,
  methodFor,
  money,
  uid,
  type Payment,
  type PaymentMethod,
  type State,
} from "./model";

/**
 * The simulated payment lifecycle.
 *
 * **Nothing here moves money.** It models the sequence decided in
 * `docs/decisions.md` #3 — approve, store a method, confirm, authorize near
 * service, capture at completion — so a backend inherits a shape rather than a
 * blank, and so the states a real integration produces have somewhere to live.
 *
 * Every function is deterministic. A real provider is asynchronous and can
 * fail after returning, which is the single largest difference between this
 * file and the thing it stands in for.
 */

/** A token shaped to look like what it is, rather than like a card. */
const simulatedToken = () => `sim_tok_${uid()}`;

/**
 * Store a method against an account. The card never reaches this application;
 * in a real integration the provider returns the token and that is all we hold.
 */
export function storePaymentMethod(
  s: State,
  accountId: string,
  card: { brand: string; last4: string },
) {
  const existing = (s.paymentMethods ?? []).find(
    (m) => m.accountId === accountId,
  );
  if (existing) return existing;
  const method: PaymentMethod = {
    id: uid(),
    accountId,
    token: simulatedToken(),
    brand: card.brand,
    last4: card.last4,
    addedAt: new Date(s.clock).toISOString(),
  };
  (s.paymentMethods ??= []).push(method);
  log(s, `Payment method stored · ${card.brand} ···· ${card.last4}`, {
    actor: "Customer",
    entity: "paymentMethod",
    entityId: method.id,
    field: "token",
    to: "stored",
  });
  return method;
}

export function forgetPaymentMethod(s: State, accountId: string) {
  s.paymentMethods = (s.paymentMethods ?? []).filter(
    (m) => m.accountId !== accountId,
  );
}

/**
 * When the authorization for a visit should be placed.
 *
 * Inside the window, at confirmation. Beyond it, a fixed lead before service,
 * because a hold placed now would have expired by the time anyone arrives.
 */
export function authorizeAt(s: State, serviceAt: string) {
  const service = +new Date(serviceAt);
  const window = AUTHORIZE_WITHIN_DAYS * 86400000;
  return service - s.clock <= window ? s.clock : service - window;
}

/** True when the authorization for this service date is due now. */
export const authorizationDue = (s: State, serviceAt: string) =>
  authorizeAt(s, serviceAt) <= s.clock;

/**
 * Place a hold. Money does not move; that is `capturePayment`.
 *
 * Returns the existing payment for a repeated `opKey` rather than a second
 * hold, the same rule `bookVisit()` follows: a double submit must not put two
 * holds on someone's card.
 */
export function authorizePayment(
  s: State,
  quoteId: string,
  opKey: string,
): Payment | null {
  const already = s.payments.find((p) => p.reference === opKey);
  if (already) return already;
  const q = s.quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "Approved") return null;
  const method = methodFor(s, q);
  if (!method) return null;
  const payment: Payment = {
    id: uid(),
    quoteId,
    status: "Authorized",
    amount: q.amount,
    reference: opKey,
    methodId: method.id,
    authorizedAt: new Date(s.clock).toISOString(),
  };
  s.payments.push(payment);
  log(s, `Authorized ${money(q.amount)} · not yet charged`, {
    actor: "System",
    requestId: q.requestId,
    entity: "payment",
    entityId: payment.id,
    field: "status",
    to: "Authorized",
  });
  return payment;
}

/**
 * Take the money, at completion.
 *
 * A capture that fails leaves `Outstanding` rather than `Failed`: the work has
 * been done and somebody owes for it, which is a different situation from a
 * charge that never started, and it is the one the operator has to chase.
 */
export function capturePayment(s: State, paymentId: string, fail = false) {
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || p.status !== "Authorized") return false;
  const q = s.quotes.find((x) => x.id === p.quoteId);
  p.status = fail ? "Outstanding" : "Paid";
  if (!fail) p.capturedAt = new Date(s.clock).toISOString();
  log(
    s,
    fail
      ? `Capture failed · ${money(p.amount)} outstanding`
      : `Captured ${money(p.amount)}`,
    {
      actor: "System",
      ...(q ? { requestId: q.requestId } : {}),
      entity: "payment",
      entityId: p.id,
      field: "status",
      from: "Authorized",
      to: p.status,
    },
  );
  return true;
}

/**
 * Send money back, in whole or in part.
 *
 * Partial refunds are their own status rather than a `Paid` row with an amount
 * beside it, because "we refunded one task of four" is a state an operator
 * filters on and a full refund is not the same thing.
 */
export function refundPayment(s: State, paymentId: string, amount?: number) {
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || !["Paid", "Partially Refunded"].includes(p.status)) return false;
  const already = p.refunded ?? 0;
  const asked = amount ?? p.amount - already;
  if (asked <= 0 || already + asked > p.amount) return false;
  p.refunded = already + asked;
  const was = p.status;
  p.status = p.refunded >= p.amount ? "Refunded" : "Partially Refunded";
  const q = s.quotes.find((x) => x.id === p.quoteId);
  log(s, `Refunded ${money(asked)}`, {
    actor: "Operator",
    ...(q ? { requestId: q.requestId } : {}),
    entity: "payment",
    entityId: p.id,
    field: "status",
    from: was,
    to: p.status,
  });
  return true;
}

/** What is still owed across a request, for the operator's chase list. */
export const outstandingFor = (s: State, requestId: string) =>
  s.payments
    .filter(
      (p) =>
        p.status === "Outstanding" &&
        s.quotes.some((q) => q.id === p.quoteId && q.requestId === requestId),
    )
    .reduce((n, p) => n + p.amount, 0);
