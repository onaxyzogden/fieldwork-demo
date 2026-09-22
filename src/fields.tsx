import { useState } from "react";

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
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  /** Adds the error class to a `.field`/`.mini-field` label wrapper. */
  const fieldClass = (field: string, base = "field") =>
    base + (errors[field] ? " field-error" : "");

  /** Spread onto the input/select/textarea itself. */
  const invalid = (field: string) => ({
    "aria-invalid": errors[field] ? (true as const) : undefined,
  });

  /** The message, or nothing. Rendered inside the label, after the control. */
  const Message = ({ field }: { field: string }) =>
    errors[field] ? (
      <span className="field-message" role="alert">
        {errors[field]}
      </span>
    ) : null;

  return { errors, fail, clear, clearAll, fieldClass, invalid, Message };
}
