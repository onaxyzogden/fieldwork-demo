import { useEffect, useRef } from "react";

/**
 * Focus through a swap of one set of buttons for another, such as Decline
 * opening its reasons (ADR 079). Opening moves focus to the button in
 * `picker` marked `data-focus`, or else its first; closing returns it to
 * `trigger`, since the button that had focus is gone either way.
 */
export function useSwapFocus(open: boolean) {
  const picker = useRef<HTMLFieldSetElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = picker.current;
    if (open)
      (
        p?.querySelector<HTMLElement>("[data-focus]") ??
        p?.querySelector<HTMLElement>("button")
      )?.focus();
    else trigger.current?.focus();
  }, [open]);
  return { picker, trigger };
}
