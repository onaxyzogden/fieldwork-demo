import { useId, useRef, useState } from "react";

/**
 * Validation messages that sit on the field at fault.
 *
 * The customer intake already did this — "Enter a Canadian postal code, for
 * example L6J 4S7." appears under the postal code box, on the attempt, and
 * clears as it is fixed. Everywhere else the same job was done by a toast:
 * a sentence that slides in over the corner of the screen, names a field the
 * user then has to go and find, and leaves after three and a half seconds
 * whether or not it was read. Seventeen of them had accumulated.
 *
 * The reason the toast kept winning is that it is one line of code and the
 * inline version was six, repeated per field. This is those six lines, once.
 *
 * Buttons stay enabled and validate on click, which is the existing house
 * rule (see base.css): a control that looks inert but is not would be worse
 * than one that explains itself when pressed.
 *
 * Each message has an id, and its field is described by it, so a screen
 * reader hears the error with the field, not as part of its name (ADR 082).
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const base = useId();
  /* Message reads the errors through a ref, so it can be one component for
     the life of the hook. One made afresh on every render would remount, and
     re-announce its alert, whenever anything else changed (ADR 082). */
  const errorsRef = useRef(errors);
  errorsRef.current = errors;

  /** Record a problem against a field. Returns false so a guard can
   *  `return fail("provider", "…")` and read as the refusal it is. */
  const fail = (field: string, message: string) => {
    setErrors((e) => ({ ...e, [field]: message }));
    return false;
  };

  const clear = (field: string) =>
    setErrors((e) => {
      if (!(field in e)) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });

  const clearAll = () => setErrors({});

  /** Adds the error class to a `.field`/`.mini-field` wrapper. */
  const fieldClass = (field: string, base = "field") =>
    base + (errors[field] ? " field-error" : "");

  /** The id of a field's message. */
  const errorId = (field: string) => base + "err-" + field;

  /** The ids of whichever of these messages are showing, for a control that
   *  is not the field itself, such as a group or the button that failed. */
  const describedBy = (...fields: string[]) =>
    fields
      .filter((f) => errors[f])
      .map(errorId)
      .join(" ") || undefined;

  /** Spread onto the input/select/textarea itself. */
  const invalid = (field: string) => ({
    "aria-invalid": errors[field] ? (true as const) : undefined,
    "aria-describedby": describedBy(field),
  });

  /** The message, or nothing. Rendered after the label, not inside it, so it
   *  describes the field rather than naming it. */
  const [Message] = useState(
    () =>
      function Message({ field }: { field: string }) {
        const text = errorsRef.current[field];
        return text ? (
          <span className="field-message" id={errorId(field)} role="alert">
            {text}
          </span>
        ) : null;
      },
  );

  return {
    errors,
    fail,
    clear,
    clearAll,
    fieldClass,
    invalid,
    describedBy,
    errorId,
    Message,
  };
}
