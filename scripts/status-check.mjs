/**
 * Keeps docs/status-dictionary.md honest.
 *
 * A status dictionary written by hand starts going stale the first time someone
 * adds a state and forgets the document — which is the precise failure both
 * pre-implementation audits are trying to prevent, and which no amount of
 * diligence reliably avoids. So the document is checked rather than trusted.
 *
 * Two directions, because they are different mistakes:
 *
 *   undocumented — a status exists in the source and not in the dictionary.
 *     Someone added a state and did not say what it means, who causes it, or
 *     who sees it.
 *
 *   unused — the dictionary lists a status no source produces. Either it was
 *     removed and the document still promises it, or it was written down as
 *     intent and never built.
 *
 * A status the dictionary deliberately records as NOT existing — "payment has
 * no Authorized state and should before production" — is written ~~struck
 * through~~. That is a claim about a gap, so the check holds it to the opposite
 * standard: it must be absent from the source, and fails if someone implements
 * it without updating the row.
 *
 * Follows scripts/catalogue.mjs: same --check shape, same place in the build.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const SRC = "src/";
const DOC = "docs/status-dictionary.md";

/**
 * A status is always reached through a record: `visit.status`, `a?.status`.
 * A bare local named `status` is not one — Blueprint.tsx compares a stage's
 * capability label that way, and it is not part of this vocabulary.
 */
/* The character before `.status` may close an index or a call —
   `payments[0].status`, `at(-1)?.status` — so the class allows those too. */
const OWNED = String.raw`[\w$\])]\??\.status`;

/** Derived labels come out of named helpers; capture only what they return. */
const DERIVED = {
  "work.ts": ["workStatus"],
  "dispatch.ts": ["dispatchStatus"],
  "pmw.ts": ["findingState"],
};

/** Two lists that are part of the vocabulary without being a `status` field. */
const LISTS = [
  ["work.ts", /export const outcomes = \[([\s\S]*?)\]/, "outcomes"],
  ["main.tsx", /customerStatusText = \(status: string\) =>\s*\(\{([\s\S]*?)\}\)/, "customerStatusText"],
];

function block(text, from) {
  let depth = 0;
  const start = text.indexOf("{", from);
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start, i);
  }
  return "";
}

/**
 * The whole statement after an assignment, so reconcile()'s multi-line ternary
 * chain is read as one expression rather than line by line.
 *
 * Assignments only — `=` not followed by `=`, or `status:` in an object
 * literal. An earlier version accepted `===` too, and then ran to the next
 * top-level `;`, which in a TSX file is several hundred lines away: it reported
 * every class name in the render tree as a status.
 */
function statementsAfterStatus(text) {
  const out = [];
  const assign = new RegExp(String.raw`(?:` + OWNED + String.raw`\s*=(?!=)|\bstatus\s*:)\s*`, "g");
  for (const m of text.matchAll(assign)) {
    const from = m.index + m[0].length;
    let depth = 0,
      i = from;
    for (; i < text.length; i++) {
      const c = text[i];
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) {
        if (depth === 0) break;
        depth--;
      } else if ((c === ";" || c === ",") && depth === 0) break;
    }
    out.push(text.slice(from, i));
  }
  return out;
}

export function statusesInSource(dir = SRC) {
  const found = new Map();
  const note = (value, where) => {
    if (!found.has(value)) found.set(value, new Set());
    found.get(value).add(where);
  };
  for (const file of readdirSync(dir).filter(
    (f) => /\.tsx?$/.test(f) && !f.includes(".test."),
  )) {
    const text = readFileSync(dir + file, "utf8");
    const at = (index) => `${file}:${text.slice(0, index).split("\n").length}`;

    for (const stmt of statementsAfterStatus(text)) {
      /* Result position only. `status: providerId === "yousef" ? "Accepted" :
         "Offered"` assigns two statuses and mentions a provider id; the
         condition is not part of the vocabulary. */
      const bare = /^\s*"([^"]+)"\s*$/.exec(stmt);
      if (bare) note(bare[1], `${file} · assignment`);
      else
        for (const q of stmt.matchAll(/[?:]\s*"([^"]+)"/g))
          note(q[1], `${file} · assignment`);
    }

    for (const m of text.matchAll(
      new RegExp(OWNED + String.raw`\s*[!=]==\s*"([^"]+)"`, "g"),
    ))
      note(m[1], at(m.index));

    for (const m of text.matchAll(
      /\[([^\]]*)\]\s*\.includes\(\s*[\w.?]*status\s*\)/g,
    ))
      for (const q of m[1].matchAll(/"([^"]+)"/g)) note(q[1], at(m.index));

    // a declared union: status: "Draft" | "Sent" | "Converted"
    for (const m of text.matchAll(/\bstatus\??:\s*((?:"[^"]+"\s*\|\s*)+"[^"]+")/g))
      for (const q of m[1].matchAll(/"([^"]+)"/g))
        note(q[1], `${file} · union`);

    for (const fn of DERIVED[file] || []) {
      const start = text.indexOf(`export function ${fn}`);
      if (start < 0) continue;
      const body = block(text, start);
      // returned labels only: `? "X"`, `: "X"`, `return "X"`
      for (const m of body.matchAll(/(?:\?|:|return)\s*"([A-Z][^"]*)"/g))
        note(m[1], `${file} · ${fn}()`);
    }

    for (const [f, re, label] of LISTS) {
      if (f !== file) continue;
      const m = text.match(re);
      if (!m) continue;
      for (const q of m[1].matchAll(/"([^"]+)"/g))
        note(q[1], `${file} · ${label}`);
    }
  }
  return found;
}

/**
 * The first column of every table row in the dictionary. Header rows and the
 * `|---|` separators are skipped, so "Status" and "Label" are not read as
 * statuses. A ~~struck-through~~ value is a documented gap, not a claim that
 * the status exists.
 */
export function statusesInDoc(path = DOC) {
  const lines = readFileSync(path, "utf8").split("\n");
  const listed = new Set();
  const absent = new Set();
  lines.forEach((line, i) => {
    if (!line.startsWith("|")) return;
    if (/^\|[\s:|-]+\|/.test(line)) return; // separator
    if ((lines[i + 1] || "").match(/^\|[\s:|-]+\|/)) return; // header
    const cell = line.split("|")[1]?.trim() ?? "";
    const struck = /^~~(.+)~~$/.exec(cell);
    for (const part of (struck ? struck[1] : cell).split("/")) {
      const value = part.replace(/`/g, "").trim();
      if (!value || value.startsWith("*")) continue;
      (struck ? absent : listed).add(value);
    }
  });
  return { listed, absent };
}

export function compare(found, { listed, absent }) {
  const undocumented = [...found.keys()].filter(
    (v) => !listed.has(v) && !absent.has(v),
  );
  const unused = [...listed].filter((v) => !found.has(v));
  // A row claiming a status does not exist, when it now does.
  const resurrected = [...absent].filter((v) => found.has(v));
  return {
    undocumented: undocumented.sort(),
    unused: unused.sort(),
    resurrected: resurrected.sort(),
  };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href
) {
  const found = statusesInSource();
  const { undocumented, unused, resurrected } = compare(found, statusesInDoc());
  const problems = [];
  if (undocumented.length)
    problems.push(
      `In the source but not in ${DOC}:\n` +
        undocumented
          .map((v) => `  "${v}"  ${[...found.get(v)].slice(0, 2).join(", ")}`)
          .join("\n"),
    );
  if (unused.length)
    problems.push(
      `In ${DOC} but produced by no source file:\n` +
        unused.map((v) => `  "${v}"`).join("\n"),
    );
  if (resurrected.length)
    problems.push(
      `${DOC} records these as not implemented, but the source now produces them:\n` +
        resurrected.map((v) => `  "${v}"`).join("\n"),
    );
  if (problems.length) {
    console.error(
      problems.join("\n\n") +
        `\n\nEvery status needs a row saying what sets it and who sees it.` +
        `\nEdit ${DOC}, or remove the status.`,
    );
    process.exit(1);
  }
  console.log(
    `Status dictionary matches the source: ${found.size} values documented.`,
  );
}
