export type Question = {
  id: string;
  label: string;
  options?: string[];
  when?: string;
};
export type Issue = {
  id: string;
  title: string;
  match: RegExp;
  review: boolean;
  questions: Question[];
};
const q = (
  id: string,
  label: string,
  options?: string,
  when?: string,
): Question => ({
  id,
  label,
  options: options ? [...options.split("|"), "Not sure"] : undefined,
  when,
});
const issue = (
  id: string,
  title: string,
  match: RegExp,
  review: boolean,
  questions: Question[],
): Issue => ({ id, title, match, review, questions });
const tried = q(
  "tried",
  "What has already been tried, including any drain-cleaning product?",
);
const otherDrains = q(
  "other",
  "Are other sinks, toilets, or drains affected?",
  "No, only this fixture|Yes, other fixtures too",
);
const wall = q(
  "wall",
  "What is the wall made of?",
  "Drywall|Plaster|Brick or concrete|Tile",
);
const supplied = q(
  "supplied",
  "Are the products and installation hardware already available?",
  "Yes|Some parts only|No",
);
export const issues: Issue[] = [
  issue(
    "sink-drain",
    "Clogged sink",
    /\bsink\b.*\b(clog|block|slow|back|drains? slowly|(?:will not|won.t|not) drain)|\b(clogged|blocked|slow.draining)\b.*\bsink\b/i,
    true,
    [
      q(
        "location",
        "Which sink is affected?",
        "Kitchen|Bathroom|Laundry|Other",
      ),
      q(
        "drainage",
        "What happens when water drains?",
        "Drains slowly|Completely blocked|Water backs up",
      ),
      otherDrains,
      tried,
    ],
  ),
  issue(
    "bath-drain",
    "Clogged bath or shower",
    /\b(bath|bathtub|tub|shower)\b.*\b(clog|block|slow|drain)|\b(clogged|blocked)\b.*\b(bath|tub|shower)\b/i,
    true,
    [
      q(
        "fixture",
        "Is this a bathtub or shower?",
        "Bathtub|Shower|Combined bath and shower",
      ),
      q(
        "drainage",
        "Does water drain slowly or remain standing?",
        "Drains slowly|Remains standing|Backs up",
      ),
      otherDrains,
      tried,
    ],
  ),
  issue(
    "toilet-block",
    "Blocked or overflowing toilet",
    /\btoilet\b.*\b(clog|block|overflow|flush|back)|\b(clogged|blocked|overflowing)\b.*\btoilet\b/i,
    true,
    [
      q("symptom", "What is happening?", "Blocked|Drains slowly|Overflowing"),
      q("spill", "Is water currently spilling onto the floor?", "Yes|No"),
      otherDrains,
      q("start", "When did this start, and was anything unusual flushed?"),
    ],
  ),
  issue(
    "toilet-running",
    "Running toilet",
    /\btoilet\b.*\b(run|refill)|\brunning\b.*\btoilet\b/i,
    true,
    [
      q(
        "frequency",
        "Does water run continuously or occasionally?",
        "Continuously|Occasionally",
      ),
      q("refill", "Does the tank refill without flushing?", "Yes|No"),
      q("outside", "Is there water outside the toilet?", "Yes|No"),
      q("count", "How many toilets are affected?"),
    ],
  ),
  issue(
    "fixture-replace",
    "Faucet or fixture replacement",
    /\b(replace|replacement|install|new)\b.*\b(faucet|tap|sink|toilet)\b|\b(faucet|tap|sink|toilet)\b.*\b(replace|replacement|install)\b/i,
    true,
    [
      q("items", "What needs replacing, and how many?"),
      supplied,
      q("model", "What is the model or product link? A photo is also helpful."),
      q(
        "connections",
        "Are connections or the fixture location changing?",
        "Like-for-like replacement|Connections or location changing",
      ),
    ],
  ),
  issue(
    "sink-leak",
    "Leak under sink",
    /\b(leak|leaking|water)\b.*\b(under|underneath|beneath|sink)\b|\bsink\b.*\b(leak|leaking)\b/i,
    true,
    [
      q(
        "source",
        "Where is water visible?",
        "Supply connection|Drain pipe|Unknown location",
      ),
      q(
        "frequency",
        "When does the leak happen?",
        "Continuously|Only when the sink is used",
      ),
      q(
        "spread",
        "Is the water contained or spreading?",
        "Contained|Spreading",
      ),
      q("damage", "Is there visible cabinet or floor damage?", "Yes|No"),
    ],
  ),
  issue(
    "faucet-leak",
    "Leaking faucet",
    /\b(faucet|tap)\b.*\b(drip|leak)|\b(dripping|leaking)\b.*\b(faucet|tap)\b/i,
    true,
    [
      q("location", "Which fixture and room?"),
      q(
        "source",
        "Where does the water appear?",
        "Spout|Handle or base|Underneath",
      ),
      q(
        "frequency",
        "Does it happen when the tap is off, on, or both?",
        "Off|On|Both",
      ),
      q(
        "preference",
        "Would you prefer repair or replacement?",
        "Repair|Replacement|Please advise",
      ),
    ],
  ),
  issue(
    "door-adjust",
    "Door sticking or not latching",
    /\bdoor\b.*\b(stick|rub|close|latch)|\b(sticking|rubbing)\b.*\bdoor\b/i,
    false,
    [
      q("location", "Is it an interior or exterior door?", "Interior|Exterior"),
      q(
        "symptom",
        "What is the door doing?",
        "Rubbing or sticking|Not latching|Will not close",
      ),
      q(
        "damage",
        "Is the door or frame visibly damaged?",
        "No visible damage|Damaged or cracked",
      ),
      q("count", "How many doors are affected?"),
    ],
  ),
  issue(
    "door-hardware",
    "Loose handle, lock, or hinge",
    /\b(handle|lock|hinge)\b.*\b(loose|broken|repair|replace)|\b(loose|broken)\b.*\b(handle|lock|hinge)\b/i,
    false,
    [
      q("part", "Which part is loose or broken?", "Handle|Lock|Hinge"),
      q(
        "location",
        "Is it on an interior or exterior door?",
        "Interior|Exterior",
      ),
      q(
        "secure",
        "Can the door currently close and lock?",
        "Yes|Closes but cannot lock|Cannot close",
      ),
      supplied,
    ],
  ),
  issue(
    "cabinet",
    "Cabinet door or drawer problem",
    /\b(cabinet|drawer)\b.*\b(stuck|loose|damage|broken|misalign|align|repair|fix)|\b(stuck|loose|broken)\b.*\b(cabinet|drawer)\b/i,
    false,
    [
      q("symptom", "What is wrong?", "Misaligned|Loose|Stuck|Damaged"),
      q("count", "How many doors or drawers are affected?"),
      q("parts", "Are hinges, runners, or handles broken or missing?"),
      q(
        "photo",
        "Can you add a photo using the photo button below?",
        "Photo available|No photo available",
      ),
    ],
  ),
  issue(
    "damp",
    "Water stain or damp wall/ceiling",
    /\b(water stain|damp|wet|sagging)\b.*\b(wall|ceiling)\b|\b(wall|ceiling)\b.*\b(wet|damp|water stain|sagging)\b/i,
    true,
    [
      q("location", "Where is the affected area?"),
      q(
        "condition",
        "What is its current condition?",
        "Wet or spreading|Old dry stain",
      ),
      q(
        "source",
        "Is the source known or already repaired?",
        "Source unknown|Known but not repaired|Already repaired",
      ),
      q("sagging", "Is there visible sagging or bulging?", "Yes|No"),
    ],
  ),
  issue(
    "drywall",
    "Drywall hole or crack",
    /\bdrywall\b|\b(hole|crack|dent)\b.*\bwall\b/i,
    false,
    [
      q("damage", "What kind of damage is it?", "Hole|Crack|Dent|Peeling"),
      q("size", "Approximately how large is it, and how many areas?"),
      q("damp", "Is there dampness or staining?", "Yes|No"),
      q("finish", "What finish would you like?", "Patch only|Patch and paint"),
    ],
  ),
  issue(
    "paint",
    "Painting or touch-up",
    /\b(paint|painting|touch.up)\b/i,
    false,
    [
      q("surfaces", "Which surfaces and how many rooms or areas?"),
      q("size", "What are the approximate dimensions?"),
      q("prep", "Are repairs or stain treatment needed first?", "Yes|No"),
      q("paint", "Is matching paint available?", "Yes|No"),
    ],
  ),
  issue("shelves", "Shelf installation", /\bshel(f|ves|ving)\b/i, false, [
    q("count", "How many shelves, and what sizes?"),
    q("load", "What will the shelves hold?"),
    wall,
    supplied,
  ]),
  issue("tv", "TV mounting", /\b(tv|television)\b/i, false, [
    q("model", "What size and model is the TV?"),
    q("mount", "Is a compatible mount available?", "Yes|No"),
    wall,
    q(
      "cables",
      "What cable work is requested?",
      "None|Surface cable cover|Conceal cables inside wall|New electrical outlet",
    ),
  ]),
  issue(
    "hanging",
    "Picture or mirror hanging",
    /\b(picture|mirror|artwork)\b/i,
    false,
    [
      q("count", "How many items need hanging?"),
      q("size", "What are their approximate sizes and weights?"),
      wall,
      supplied,
    ],
  ),
  issue(
    "curtains",
    "Curtains or blinds",
    /\b(curtain|curtains|blind|blinds)\b/i,
    false,
    [
      q("count", "How many windows?"),
      q("work", "What work is needed?", "Install|Replace|Repair"),
      q("products", "Are the products purchased and sized?", "Yes|No"),
      q("height", "What is the approximate installation height?"),
    ],
  ),
  issue(
    "assembly",
    "Furniture assembly",
    /\b(assembl\w*|ikea|wardrobe|furniture)\b/i,
    false,
    [
      q("items", "Which items need assembling, and how many?"),
      q("model", "Can you provide product links or models?"),
      q(
        "parts",
        "Are all boxes, parts, and instructions available?",
        "Yes|Some are missing",
      ),
      q(
        "extra",
        "Is wall anchoring or moving existing furniture needed?",
        "Neither|Wall anchoring|Moving furniture|Both",
      ),
    ],
  ),
  issue(
    "accessory",
    "Loose towel bar or bathroom accessory",
    /\b(towel (bar|rack)|toilet.paper holder|bathroom accessory)\b/i,
    false,
    [
      q("items", "Which accessory and how many?"),
      q("damage", "What is the problem?", "Loose|Broken|Pulled out of wall"),
      wall,
      supplied,
    ],
  ),
  issue(
    "sealant",
    "Caulk or sealant replacement",
    /\b(caulk|caulking|sealant)\b/i,
    false,
    [
      q("location", "Where is the sealant?", "Tub|Shower|Sink|Other"),
      q("condition", "What is wrong with it?", "Cracked|Missing|Discoloured"),
      q(
        "leak",
        "Is there active leakage or soft/damaged material nearby?",
        "Yes|No",
      ),
      q("size", "Approximately how much needs replacing?"),
    ],
  ),
  issue("fence", "Fence or gate repair", /\b(fence|gate)\b/i, false, [
    q("part", "Which part needs repair?", "Panel|Post|Hinge|Latch"),
    q("count", "How many sections are affected?"),
    q("material", "What material is it?", "Wood|Metal|Vinyl"),
    q("stable", "Is anything leaning, detached, or unstable?", "Yes|No"),
  ]),
  issue("deck", "Deck or step repair", /\b(deck|steps|railing)\b/i, false, [
    q("part", "Which parts are affected?", "Boards|Steps|Railings|Supports"),
    q("count", "How many areas need repair?"),
    q("stable", "Is there visible rot, movement, or instability?", "Yes|No"),
    q(
      "photo",
      "Can you add an overview photo and a close-up?",
      "Photos available|No photos available",
    ),
  ]),
  issue(
    "outlet",
    "Outlet or switch problem",
    /\b(outlet|socket|switch)\b/i,
    true,
    [
      q("symptom", "What is wrong?", "Not working|Loose|Damaged|Intermittent"),
      q("count", "How many are affected?"),
      q(
        "hazard",
        "Have you noticed heat, a burning smell, sparks, or discolouration?",
        "Yes|No",
      ),
      q("breaker", "Is a related breaker repeatedly tripping?", "Yes|No"),
    ],
  ),
  issue(
    "lighting",
    "Light fixture or ceiling fan",
    /\b(light fixture|ceiling fan|light fitting)\b/i,
    true,
    [
      q("work", "What work is needed?", "Repair|Replace|New installation"),
      q("existing", "Is there an existing fixture at that location?", "Yes|No"),
      q("height", "What is the ceiling height?"),
      q(
        "model",
        "Is the replacement purchased? Please share its model or link.",
      ),
    ],
  ),
  issue(
    "wiring",
    "Breaker, wiring, or circuit request",
    /\b(breaker|wiring|circuit|electrical)\b/i,
    true,
    [
      q("symptom", "What change or symptom prompted the request?"),
      q("location", "Which rooms or fixtures are affected?"),
      q(
        "frequency",
        "Is the problem ongoing or intermittent?",
        "Ongoing|Intermittent",
      ),
      q(
        "hazard",
        "Have you noticed heat, burning smells, sparks, or repeated trips?",
        "Yes|No",
      ),
    ],
  ),
];
export const fallback = issue(
  "unknown",
  "Tell us about the problem",
  /$^/,
  true,
  [
    q("item", "Which item or part of your home needs attention?"),
    q("symptom", "What is happening, or what would you like changed?"),
    q("extent", "How many items or areas are affected?"),
  ],
);
function clean(description: string) {
  return description.replace(
    /\b(?:no|not|without)\s+(?:a\s+)?(?:clogged|blocked|leaking|broken)\b/gi,
    "",
  );
}
export function matchIssues(description: string): Issue[] {
  return issues.filter((i) => i.match.test(clean(description)));
}
export function getIssue(description: string): Issue {
  return matchIssues(description)[0] || fallback;
}
export const answerKey = (i: Issue, q: Question) => `${i.id}:${q.id}`;
export function inferredAnswers(description: string): Record<string, string> {
  const i = getIssue(description);
  const a: Record<string, string> = {};
  if (i.id === "sink-drain") {
    const locations = ["Kitchen", "Bathroom", "Laundry"].filter((s) =>
      new RegExp(`\\b${s}\\s+sink\\b`, "i").test(description),
    );
    if (locations.length === 1) a["sink-drain:location"] = locations[0];
    if (
      /\bdrains? slowly\b|\bslow.draining\b/i.test(description) &&
      !/\bnot\s+(?:draining|slow)/i.test(description)
    )
      a["sink-drain:drainage"] = "Drains slowly";
  }
  return a;
}
export function questionAnswers(t: {
  description: string;
  answers: Record<string, string>;
}) {
  const inferred = inferredAnswers(t.description);
  const active = getIssue(t.description);
  const entries = { ...inferred, ...t.answers };
  return Object.entries(entries)
    .filter(
      ([key, value]) =>
        value &&
        (!key.includes(":") ||
          key.startsWith(active.id + ":") ||
          key === "intake:details"),
    )
    .map(([key, value]) => ({
      key,
      label:
        key === "intake:details"
          ? "Additional details"
          : (key.endsWith(":product")
              ? "Which product was used, and when?"
              : undefined) ||
            active.questions.find((q) => answerKey(active, q) === key)?.label ||
            key,
      value,
      inferred: !(key in t.answers) && key in inferred,
    }));
}
export function needsClarificationReview(t: {
  description: string;
  answers: Record<string, string>;
}) {
  const i = getIssue(t.description);
  const a = Object.fromEntries(
    Object.entries(t.answers).filter(([key]) => key.startsWith(i.id + ":")),
  );
  return (
    i.review ||
    ["drywall:damp", "sealant:leak", "fence:stable", "deck:stable"].some(
      (k) => a[k] === "Yes",
    ) ||
    ["Conceal cables inside wall", "New electrical outlet"].includes(
      a["tv:cables"],
    )
  );
}
export function reportedConcern(t: {
  description: string;
  answers: Record<string, string>;
}) {
  return (
    questionAnswers(t).some(
      ({ key, value }) =>
        /:(hazard|spill|sagging|stable|damp|leak)$/.test(key) &&
        value === "Yes",
    ) ||
    (getIssue(t.description).id === "sink-leak" &&
      t.answers["sink-leak:spread"] === "Spreading") ||
    (["sink-drain", "bath-drain", "toilet-block"].includes(
      getIssue(t.description).id,
    ) &&
      t.answers[getIssue(t.description).id + ":other"] ===
        "Yes, other fixtures too")
  );
}
