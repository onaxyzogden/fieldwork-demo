/** A count and its noun, singular for exactly one: "1 task", "2 tasks" (ADR 083). */
export const plural = (n: number, word: string, many = word + "s") =>
  `${n} ${n === 1 ? word : many}`;
