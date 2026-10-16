import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { useModal } from "./useModal";
import "./onsite.css";

/**
 * The one-at-a-time layer the customer's and contractor's queues share
 * (ADR 062), on the same rules as the operator's (ADR 059).
 *
 * The order is fixed when it opens, so the list does not reshuffle under the
 * thumb, but each item is read live: something already handled elsewhere is
 * passed over without a screen. An item acted on goes to the back, so if it
 * now needs something else (a quote approved, now to pay) it comes round
 * again; if not, it is passed over too.
 *
 * `last` marks items that must stay at the very end — the customer's
 * assessments, which leave the queue — so a requeued item goes in ahead of
 * them rather than behind where it would never be reached.
 */
export function useOneAtATime(
  initial: string[],
  live: (key: string) => boolean,
  last: (key: string) => boolean = () => false,
) {
  const [order, setOrder] = useState(initial);
  const [at, setAt] = useState(0);
  const [seen, setSeen] = useState(0);
  const [handled, setHandled] = useState(0);
  let cur = at;
  while (cur < order.length && !live(order[cur])) cur++;
  const key = order[cur] as string | undefined;
  const left = order.slice(cur).filter(live).length;
  return {
    key,
    /** "2 of 3", counting what has been shown and what is still to come. */
    position: key ? `${seen + 1} of ${seen + left}` : "",
    handled,
    /** A fresh value per screen, for keying its component and its state. */
    screen: `${seen}-${key}`,
    advance(acted: boolean) {
      if (acted && key) {
        const tail = order.findIndex((k, i) => i > cur && last(k));
        setOrder(
          tail < 0
            ? [...order, key]
            : [...order.slice(0, tail), key, ...order.slice(tail)],
        );
        setHandled(handled + 1);
      }
      setSeen(seen + 1);
      setAt(cur + 1);
    },
  };
}

export function QueueLayer({
  label,
  position,
  screen,
  close,
  aside,
  children,
}: {
  label: string;
  position: string;
  screen: string;
  close: () => void;
  /** Read-only context beside the item on desktop (ADR 068). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, close);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    ref.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [screen]);
  return (
    <div
      className="onsite"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      ref={ref}
    >
      <div className="onsite-frame">
        <div className="onsite-body">
          <header className="onsite-head">
            <span>{position || label}</span>
            <button className="text-button" onClick={close}>
              Close
            </button>
          </header>
          {children}
        </div>
        {aside}
      </div>
    </div>
  );
}

/**
 * The end of a queue: what was done, what is still waiting, and the way back.
 * A skipped item is still waiting, so the queue is not "all caught up" until
 * nothing is (ADR 094, as the operator's in ADR 093).
 */
export function AllCaughtUp({
  handled,
  left,
  waiting,
  where,
  close,
}: {
  handled: number;
  /** How many still wait on this person, skipped ones included. */
  left: number;
  /** What is still waiting and where, said when `left` is more than 0. */
  waiting: string;
  /** Where anything new shows, such as "on Home". */
  where: string;
  close: () => void;
}) {
  return (
    <>
      <h1 tabIndex={-1}>{left ? "End of the queue" : "All caught up"}</h1>
      <p className="onsite-hint dq-done">
        {!left && <CheckCircle2 aria-hidden="true" size={20} />}
        {left
          ? `${handled ? `${handled} done. ` : ""}${waiting}`
          : `${handled} done. Anything new will show ${where}.`}
      </p>
      <div className="onsite-bar">
        <button className="primary full" onClick={close}>
          Back
        </button>
      </div>
    </>
  );
}
