import { useState, useRef, useSyncExternalStore } from "react";
import { type State, type Visit, dateLabel, providers } from "./model";
import { inbox, sendMessage } from "./notifications";
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
  return (
    <div className="notification-list">
      <h3>Notifications & messages</h3>
      <p>In-app simulations · updates for this account only.</p>
      <button
        className="secondary"
        onClick={() =>
          update((d) => {
            inbox(d, recipient).forEach((n) => (n.read = true));
          })
        }
      >
        Mark all read
      </button>
      {!items.length && <p>No updates yet.</p>}
      {items.map((n) => (
        <button
          className={"event notification-link " + (!n.read ? "unread" : "")}
          key={n.id}
          onClick={() => {
            update((d) => {
              const item = d.notifications?.find((x) => x.id === n.id);
              if (item) item.read = true;
            });
            open(n.requestId, n.visitId);
          }}
        >
          <span>
            <strong>{n.text}</strong>
            <small>
              {dateLabel(n.at)} · {n.read ? "Read" : "Unread"} · Open{" "}
              {n.kind === "message" ? "conversation" : "details"}
            </small>
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
  return (
    <details className="work-task message-thread" id={"messages-" + visit.id}>
      <summary>
        Messages <small>In-app simulation</small>
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
                    ? "Operator"
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
              s.requests.find((r) => r.id === visit.requestId)?.customerId ||
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
                update((d) => {
                  sendMessage(d, visit.id, sender, text);
                }, "Message sent · in-app simulation");
                setText("");
              }}
            >
              Send simulated message
            </button>
          </>
        )}
    </details>
  );
}
