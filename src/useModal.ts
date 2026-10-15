import { useEffect, useRef, type RefObject } from "react";

/**
 * A full-screen layer as a real modal (ADR 069, shared since ADR 081), on the
 * sidebar drawer's rules: Escape closes, Tab stays inside, the page behind
 * does not scroll, and focus goes back where it came from.
 *
 * The layers render inside the shell, so the shell itself cannot be made
 * inert; everything beside the layer is, level by level up to the shell,
 * which leaves the other column alone in compare mode.
 *
 * Call it before any effect that moves focus into the layer, so the element
 * that opened it is still the one focused when it is read.
 */
export function useModal(
  ref: RefObject<HTMLElement | null>,
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const back = document.activeElement as HTMLElement | null;
    const muted: HTMLElement[] = [];
    for (
      let node: HTMLElement | null = ref.current;
      node?.parentElement && !node.classList.contains("shell");
      node = node.parentElement
    )
      for (const sibling of node.parentElement.children)
        if (
          sibling !== node &&
          sibling instanceof HTMLElement &&
          !sibling.inert
        ) {
          sibling.inert = true;
          muted.push(sibling);
        }
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab" || !ref.current) return;
      const list = [
        ...ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const at = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && at <= 0) {
        e.preventDefault();
        list.at(-1)?.focus();
      } else if (!e.shiftKey && (at === list.length - 1 || at < 0)) {
        e.preventDefault();
        list[0]?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = previous;
      for (const sibling of muted) sibling.inert = false;
      /* The button that opened the layer may be gone by now (the last
         thing waiting was handled), so focus falls back to the page's
         heading rather than to nothing (ADR 079). */
      if (back?.isConnected && back !== document.body) back.focus();
      else {
        const h1 = document.querySelector<HTMLElement>("main h1");
        if (h1) {
          h1.tabIndex = -1;
          h1.focus();
        }
      }
    };
  }, [ref]);
}
