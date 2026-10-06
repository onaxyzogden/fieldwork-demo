import { useState, useRef, useSyncExternalStore } from "react";
import { type State, type Visit, dateLabel, providers } from "./model";
import { deliveryLabel, inbox, markRead, sendMessage } from "./notifications";
import { subscribeSaveHealth, isSaveFailing } from "./store";
type Update = (fn: (s: State) => void, msg?: string) => void;

/**
 * Shown whenever a write has stopped reaching the browser's storage — almost
 * always because this origin is out of room. It stays until a write succeeds,
 * because the consequence it describes stays true until then: the screen is
 * ahead of what a reload would show.
 *
 * Fixed to the viewport, and rendered outside any Workspace, so it appears
 * once whatever the role, the screen, or how many columns are on the page.
 */
export function SaveWarning() {
  const failing = useSyncExternalStore(
    subscribeSaveHealth,
    isSaveFailing,
    isSaveFailing,
  );
  if (!failing) return null;
  return (
    <div className="save-warning" role="alert">
      <strong>Changes are not being saved.</strong>
      <span>
        This browser has no room left for the demo. What you see here is
        correct, but anything added since the last successful save will be gone
        if you reload. Remove a photo, or reset the demo from Demo settings, to
        free space.
      </span>
    </div>
  );
}
export function NotificationInbox({
  s,
  recipient,
  update,
  open,
}: {
  s: State;
  recipient: string;
  update: Update;
  open: (requestId: string, visitId: string) => void;
}) {
  const items = inbox(s, recipient);
  /* A customer's inbox reads as production (ADR 061): no note about the
     simulation and no delivery rows. Staff keep both. */
  const staff = !recipient.startsWith("Customer:");
  return (
    <div className="notification-list">
      {/* No heading here: the dialog this renders inside is already titled
          "Notifications", and saying it twice is what the second line was. */}
      {staff && (
        <p>
          Updates for this account only. The channel beside each one is the one
          a real integration would use — no SMS is sent and no email is
          composed, and an external channel therefore never gets past “sent”.
        </p>
      )}
      {/* Gated on something being unread rather than on the list being
          non-empty: a list where everything is already read has nothing to
          mark either, so the button would be equally out of place. */}
      {items.some((n) => !n.read) && (
        <button
          className="secondary"
          onClick={() =>
            update((d) => {
              inbox(d, recipient).forEach((n) => markRead(d, n.id));
            })
          }
        >
          Mark all read
        </button>
      )}
      {!items.length && <p>No updates yet.</p>}
      {items.map((n) => (
        <button
          className={"event notification-link " + (!n.read ? "unread" : "")}
          key={n.id}
          onClick={() => {
            update((d) => markRead(d, n.id));
            open(n.requestId, n.visitId);
          }}
        >
          <span>
            <strong>{n.text}</strong>
            <small>
              {dateLabel(n.at)} · {n.read ? "Read" : "Unread"} · Open{" "}
              {n.kind === "message" ? "conversation" : "details"}
            </small>
            {staff && (
              <small>
                {(n.deliveries ?? []).map(deliveryLabel).join(" · ") ||
                  "In-app · delivered"}
              </small>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
export function MessageThread({
  s,
  visit,
  sender,
  update,
}: {
  s: State;
  visit: Visit;
  sender: string;
  update: Update;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  /* The customer's thread reads as production (ADR 061); staff are told the
     channel is simulated. */
  const customer = sender.startsWith("Customer:");
  return (
    <details className="work-task message-thread" id={"messages-" + visit.id}>
      <summary>
        Messages {!customer && <small>In-app simulation</small>}
      </summary>
      <div aria-live="polite">
        {visit.messages?.map((m) => (
          <div
            className={
              "message-bubble " + (m.sender === sender ? "sent" : "received")
            }
            key={m.id}
          >
            <strong>
              {m.sender === sender
                ? "You"
                : m.sender.startsWith("Customer:")
                  ? "Customer"
                  : m.sender === "Operator"
                    ? customer
                      ? "fieldwork"
                      : "Operator"
                    : providers.find((p) => p.id === m.sender)?.name ||
                      m.sender}
            </strong>
            <p>{m.text}</p>
            <small>
              {dateLabel(m.at)} · {m.sender === sender ? "Sent" : "Received"}
            </small>
          </div>
        ))}
      </div>
      {visit.status !== "Cancelled" &&
        (sender === "Operator" ||
          sender ===
            "Customer:" +
              s.requests.find((r) => r.id === visit.requestId)?.accountId ||
          s.assignments.some(
            (a) =>
              a.visitId === visit.id &&
              a.providerId === sender &&
              a.providerId === visit.providerId &&
              a.status === "Accepted",
          )) && (
          <>
            <label className={"field" + (error ? " field-error" : "")}>
              Message
              <textarea
                ref={box}
                value={text}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "message-error" : undefined}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError("");
                }}
              />
              {error && (
                <span className="field-message" id="message-error" role="alert">
                  {error}
                </span>
              )}
            </label>
            <button
              className="secondary"
              onClick={() => {
                if (!text.trim()) {
                  setError("Write a message before sending.");
                  box.current?.focus();
                  return;
                }
                update(
                  (d) => {
                    sendMessage(d, visit.id, sender, text);
                  },
                  customer
                    ? "Message sent"
                    : "Message sent · in-app simulation",
                );
                setText("");
              }}
            >
              {customer ? "Send" : "Send simulated message"}
            </button>
          </>
        )}
    </details>
  );
}
