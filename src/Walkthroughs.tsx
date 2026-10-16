import { useEffect, useId, useRef, useState } from "react";
import { Glance, GlanceLead } from "./GlanceCard";
import { glanceDate, walkthroughGlance } from "./glance";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  AlertCircle,
  Copy,
  ExternalLink,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  type State,
  type Finding,
  type Walkthrough,
  money,
  dateLabel,
  accountName,
  accounts,
  contactsFor,
  mayApprove,
  setApprover,
  duplicateProperties,
  mergeProperties,
  resolveProperty,
  type MergeResult,
  uid,
} from "./model";
import { cities } from "./intake";
import { useFieldErrors } from "./fields";
import { storablePhoto, unreadableMessage } from "./photos";
import {
  type SendBlocker,
  addFinding,
  carryCandidates,
  carryForward,
  undecided,
  assessmentTotals,
  convertApproved,
  createWalkthrough,
  findingState,
  findingsFor,
  money2,
  sendBlockers,
  sendWalkthrough,
  issueAccess,
  linkState,
  revokeAccess,
  type LinkState,
} from "./pmw";
import { assessmentLink } from "./store";
import PropertyRecord from "./PropertyRecord";
import OnSite, { type OnSiteMode } from "./OnSite";

type Props = {
  s: State;
  update: (fn: (d: State) => void, msg?: string) => void;
  notify: (msg: string) => void;
  openRequest: (id: string) => void;
};

/* Accent only where the walkthrough is the operator's to move: a draft to
   finish, or approvals to convert. Converted is green, and a walkthrough
   waiting on the customer is neutral (ADR 093). */
const statusTone = (w: Walkthrough, ready: boolean) =>
  w.status === "Converted"
    ? "green"
    : w.status === "Draft" || ready
      ? ""
      : "quiet";

/* A finding's chip follows the same rule: green when done, accent when it is
   approved and waiting to be converted, neutral otherwise (ADR 093). */
const findingTone = (state: string, f: Finding) =>
  state === "Completed"
    ? "green"
    : state === "Approved" && !f.taskId
      ? ""
      : "quiet";

export default function Walkthroughs({
  s,
  update,
  notify,
  openRequest,
}: Props) {
  const [openId, setOpenId] = useState("");
  /* The walkthrough the list was left for, so coming back puts focus on its
     row rather than on the page (ADR 093). */
  const [lastId, setLastId] = useState("");
  const choose = (id: string) => {
    setLastId(id);
    setOpenId(id);
  };
  /* On site and pricing take the whole screen, and only while the
     walkthrough is still a draft — once sent there is nothing to capture. */
  const [onSite, setOnSite] = useState<OnSiteMode | "">("");
  const open = s.walkthroughs.find((w) => w.id === openId);
  if (open && onSite && open.status === "Draft")
    return (
      <OnSite
        s={s}
        walkthrough={open}
        mode={onSite}
        update={update}
        setMode={setOnSite}
        exit={() => setOnSite("")}
      />
    );
  return open ? (
    <WalkthroughDetail
      s={s}
      walkthrough={open}
      update={update}
      notify={notify}
      openRequest={openRequest}
      onSite={setOnSite}
      back={() => setOpenId("")}
    />
  ) : (
    <WalkthroughList
      s={s}
      update={update}
      notify={notify}
      open={choose}
      returnTo={lastId}
      startOnSite={(id) => {
        choose(id);
        setOnSite("capture");
      }}
    />
  );
}

function WalkthroughList({
  s,
  update,
  notify,
  open,
  returnTo,
  startOnSite,
}: {
  s: State;
  update: Props["update"];
  notify: Props["notify"];
  open: (id: string) => void;
  /** The walkthrough just closed, whose row takes focus. */
  returnTo: string;
  /** A new walkthrough is started on site, so it opens straight into capture. */
  startOnSite: (id: string) => void;
}) {
  const { fail, clear, fieldClass, invalid, Message } = useFieldErrors();
  const [creating, setCreating] = useState(false);
  const createId = useId();
  const [propertyId, setPropertyId] = useState(s.properties[0]?.id || "");
  const [mergeNote, setMergeNote] = useState("");
  const duplicates = duplicateProperties(s);
  const pipeline = walkthroughGlance(s, +s.clock);
  const chaseProperty = s.properties.find(
    (p) => p.id === pipeline.chase?.walkthrough.propertyId,
  );
  const first = (ids: string[]) =>
    ids.length ? () => open(ids[0]) : undefined;
  const ago = (days: number) =>
    days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  /* What a merge would join, so the decision is made on evidence rather than
     on two addresses that happen to read alike. */
  const countFor = (id: string) => {
    const requests = s.requests.filter((r) => r.propertyId === id).length;
    const walkthroughs = s.walkthroughs.filter((w) => w.propertyId === id).length;
    return `${requests} request${requests === 1 ? "" : "s"}, ${walkthroughs} walkthrough${walkthroughs === 1 ? "" : "s"}`;
  };
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(cities[0]);
  const [accountId, setAccountId] = useState("c2");
  /* One state, one word: each group is captioned with the status itself,
     and its rows carry no status chip of their own (ADR 093). */
  const groups = ["Draft", "Sent", "Converted"] as const;
  const ready = new Set(pipeline.readyToConvertIds);
  const returned = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    returned.current?.focus();
  }, []);

  const start = () => {
    if (propertyId === "new" && !address.trim())
      return fail("address", "Enter the property address to start here.");
    const id = uid();
    update((d) => {
      /* The id has been sitting in component state, and another tab may have
         merged that property away in the meantime. Following the merge is the
         only place an outside id needs checking — everything the merge itself
         repointed is already correct. */
      let target = resolveProperty(d, propertyId);
      if (target === "new") {
        target = uid();
        d.properties.push({
          id: target,
          accountId,
          address: address.trim(),
          city,
        });
      }
      const w = createWalkthrough(d, target);
      w.id = id;
      /* No toast: the capture screen it opens onto says where you are, and a
         toast would sit over its Save button for three seconds. */
    });
    setCreating(false);
    setAddress("");
    startOnSite(id);
  };

  return (
    <>
      <div className="heading">
        <h1>Walkthroughs</h1>
        <button
          className="primary"
          aria-expanded={creating}
          aria-controls={creating ? createId : undefined}
          onClick={() => setCreating(!creating)}
        >
          <Plus aria-hidden="true" size={16} /> New walkthrough
        </button>
      </div>
      {/* Whose move it is, across the whole pipeline. Each number opens the
          first walkthrough it counted; a bucket with nothing in it gets no
          handler, so the card never offers a button that does nothing. */}
      <Glance
        date={glanceDate(+s.clock)}
        lead={
          pipeline.chase ? (
            <GlanceLead
              when="Oldest undecided"
              what={`${pipeline.chase.walkthrough.assessmentId} · ${chaseProperty?.address ?? ""}`}
              where={`sent ${ago(pipeline.chase.daysSent)} · ${
                pipeline.chase.opens
                  ? `opened ${pipeline.chase.opens} time${pipeline.chase.opens === 1 ? "" : "s"}`
                  : "not opened yet"
              }`}
              onClick={() => open(pipeline.chase!.walkthrough.id)}
            />
          ) : (
            <GlanceLead
              when="Oldest undecided"
              what="Nothing waiting on a customer."
            />
          )
        }
        metrics={[
          {
            label: "Drafts",
            value: pipeline.draftIds.length,
            onClick: first(pipeline.draftIds),
          },
          {
            label: "With customer",
            value: pipeline.withCustomerIds.length,
            onClick: first(pipeline.withCustomerIds),
          },
          {
            label: "Ready to convert",
            value: pipeline.readyToConvertIds.length,
            onClick: first(pipeline.readyToConvertIds),
          },
        ]}
      />
      {/* A detector nothing renders is ADR 034's defect. This is where
          duplicates are made — an operator typing an address that already
          exists — so it is where they are shown. */}
      {duplicates.length > 0 && (
        <section className="card panel">
          <div className="panel-title">
            <h2 className="look-h3">Possible duplicate properties</h2>
          </div>
          <p>
            These records read as the same place. Nothing is merged
            automatically: two addresses that look alike can be two different
            units, and a wrong merge joins two maintenance histories that cannot
            be separated again.
          </p>
          {duplicates.map((g) => (
            <div key={g.key} className="card">
              <ul>
                {g.properties.map((p) => (
                  <li key={p.id}>
                    <strong>
                      {p.address}
                      {p.unit ? ` · ${p.unit}` : ""}, {p.city}
                    </strong>{" "}
                    · {accountName(p.accountId)} ·{" "}
                    {countFor(p.id)}
                  </li>
                ))}
              </ul>
              {g.crossAccount ? (
                <p className="warning">
                  <AlertCircle aria-hidden="true" size={16} /> These are held by different
                  accounts. Correct the account before merging, or they are two
                  different places.
                </p>
              ) : (
                <>
                  <div className="row actions">
                    {g.properties.slice(1).map((p) => (
                      <button
                        key={p.id}
                        className="secondary"
                        onClick={() => {
                          let outcome = { ok: true } as MergeResult;
                          update((d) => {
                            outcome = mergeProperties(
                              d,
                              g.properties[0].id,
                              p.id,
                            );
                          });
                          setMergeNote(
                            outcome.ok
                              ? ""
                              : outcome.reason,
                          );
                        }}
                      >
                        Merge into the first record
                      </button>
                    ))}
                  </div>
                  {mergeNote && (
                    <span className="field-message" role="alert">
                      {mergeNote}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </section>
      )}
      {creating && (
        <section className="card panel" id={createId}>
          <div className="panel-title">
            <h2 className="look-h3">Start a walkthrough</h2>
          </div>
          <label className="field">
            Property
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {s.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}, {p.city} · {accountName(p.accountId)}
                </option>
              ))}
              <option value="new">Add a new property…</option>
            </select>
          </label>
          {propertyId === "new" && (
            <>
              <div className={fieldClass("address")}>
                <label className="field-label">
                  Street address
                  <input
                    value={address}
                    {...invalid("address")}
                    onChange={(e) => {
                      clear("address");
                      setAddress(e.target.value);
                    }}
                    placeholder="120 Kerr Street"
                  />
                </label>
                <Message field="address" />
              </div>
              <div className="row">
                <label className="mini-field">
                  City
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  >
                    {cities.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="mini-field">
                  Owner / manager
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    {["c1", "c2", "c3", "c4", "c5"].map((id) => (
                      <option key={id} value={id}>
                        {accountName(id)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          <button className="primary" onClick={start}>
            Start walkthrough <ArrowRight aria-hidden="true" size={16} />
          </button>
        </section>
      )}
      {!s.walkthroughs.length && !creating && (
        <section className="card panel">
          <p className="wt-fact">
            No walkthroughs yet. Start one to record findings against a
            property.
          </p>
        </section>
      )}
      {groups.map((status) => {
        const rows = s.walkthroughs.filter((w) => w.status === status);
        if (!rows.length) return null;
        return (
          <section className="card panel wt-group" key={status}>
            <div className="panel-title">
              <h2 className="look-h3">{status}</h2>
              <span className="count">{rows.length}</span>
            </div>
            {rows.map((w) => {
              const property = s.properties.find((p) => p.id === w.propertyId);
              const totals = assessmentTotals(s, w.id);
              return (
                <button
                  className="queue-item"
                  key={w.id}
                  ref={w.id === returnTo ? returned : undefined}
                  onClick={() => open(w.id)}
                >
                  <p>
                    <strong>{w.assessmentId}</strong>
                    {ready.has(w.id) && (
                      <span className="badge">Ready to convert</span>
                    )}
                  </p>
                  <small>
                    {property?.address}, {property?.city} ·{" "}
                    {totals.findings.length} finding
                    {totals.findings.length === 1 ? "" : "s"}
                    {totals.approved.length
                      ? ` · ${money(totals.subtotal)} approved`
                      : ""}
                  </small>
                </button>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

function WalkthroughDetail({
  s,
  walkthrough: w,
  update,
  notify,
  openRequest,
  onSite,
  back,
}: {
  s: State;
  walkthrough: Walkthrough;
  update: Props["update"];
  notify: Props["notify"];
  openRequest: Props["openRequest"];
  onSite: (mode: OnSiteMode) => void;
  back: () => void;
}) {
  const property = s.properties.find((p) => p.id === w.propertyId);
  const totals = assessmentTotals(s, w.id);
  const findings = findingsFor(s, w.id);
  /* A removed finding can be put back where it was (ADR 079), as intake's
     tasks can. Focus goes to Undo, since the card it was in is gone. */
  const [removed, setRemoved] = useState<{
    finding: Finding;
    index: number;
  } | null>(null);
  const undo = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (removed) undo.current?.focus();
  }, [removed]);
  const draft = w.status === "Draft";
  /* Opening a walkthrough replaces the list, and the row that had focus is
     gone, so focus goes to the heading that names it (ADR 093). */
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  /* What earlier visits to this property left unresolved. Only while this one
     is still a draft: carrying into a sent assessment would change what the
     customer is already looking at. */
  const carryable = carryCandidates(s, w.id);
  /* What is standing between this assessment and the customer. The draft card
     only offers Send once this is empty; anything unpriced goes through the
     pricing step, which names the missing title or price on its own field. */
  const blockers = sendBlockers(s, w.id);
  const send = () => {
    update((d) => {
      sendWalkthrough(d, w.id);
    }, "Assessment sent to the customer");
  };
  const converted = s.requests.find((r) => r.walkthroughId === w.id);
  const state = linkState(s, w);
  const link = w.access ? assessmentLink(w.access.token) : "";

  const patch = (id: string, values: Partial<Finding>, msg?: string) =>
    update((d) => {
      const f = d.findings.find((f) => f.id === id);
      if (f) Object.assign(f, values);
    }, msg);

  /** Reports whether the file made it in, so the card holding the control can
      put the reason under that control rather than in a passing toast. */
  const attach = async (f: Finding, file?: File) => {
    if (!file) return true;
    const stored = await storablePhoto(file);
    if (!stored) return false;
    patch(f.id, { photos: [...f.photos, stored] });
    return true;
  };

  return (
    <>
      <button className="text-button" onClick={back}>
        <ArrowLeft aria-hidden="true" size={16} /> All walkthroughs
      </button>
      <div className="heading wt-head">
        <div>
          <span className="eyebrow">Assessment {w.assessmentId}</span>
          <h1 ref={heading} tabIndex={-1}>
            {property?.address}, {property?.city}
          </h1>
          <p>
            {accountName(property?.accountId || "")} ·{" "}
            {dateLabel(w.sentAt || w.date)}
          </p>
        </div>
        <span
          className={
            "badge " +
            statusTone(w, w.status === "Sent" && totals.approved.length > 0)
          }
        >
          {w.status}
        </span>
      </div>

      <NextStep
        s={s}
        walkthrough={w}
        totals={totals}
        link={link}
        state={state}
        notify={notify}
        update={update}
        openRequest={openRequest}
        converted={converted?.id}
        blockers={blockers}
        send={send}
        onSite={onSite}
      />

      {findings.map((f) => (
        <FindingCard
          key={f.id}
          s={s}
          finding={f}
          editable={draft}
          patch={patch}
          attach={attach}
          remove={() => {
            setRemoved({
              finding: structuredClone(f),
              index: s.findings.findIndex((x) => x.id === f.id),
            });
            update((d) => {
              d.findings = d.findings.filter((x) => x.id !== f.id);
            });
          }}
        />
      ))}
      {removed && (
        <div role="status" className="note">
          Finding removed.{" "}
          <button
            ref={undo}
            className="text-button"
            onClick={() => {
              const { finding, index } = removed;
              update((d) => {
                d.findings.splice(
                  Math.min(index, d.findings.length),
                  0,
                  finding,
                );
              });
              setRemoved(null);
              requestAnimationFrame(() =>
                document
                  .getElementById("finding-" + finding.id)
                  ?.querySelector<HTMLElement>("summary")
                  ?.focus(),
              );
            }}
          >
            Undo
          </button>
        </div>
      )}

      {draft && (
        <button
          className="secondary full actions"
          onClick={() =>
            update((d) => {
              addFinding(d, w.id);
            }, "Finding added")
          }
        >
          <Plus aria-hidden="true" size={16} /> Add finding
        </button>
      )}
      {draft && !!carryable.length && (
        <section className="card panel">
          <div className="panel-title">
            <h2 className="look-h3">Still open from earlier visits</h2>
            <span className="count">{carryable.length}</span>
          </div>
          <p className="note">
            Items the customer deferred, items that needed a closer look, and
            items left undecided when earlier work went ahead. Carrying one
            restates it here, with its own price and its own decision, and marks
            the original as superseded.
          </p>
          {carryable.map((f) => (
            <div className="row between carry-forward" key={f.id}>
              <div>
                <strong>{f.title || "Untitled finding"}</strong>
                <small>
                  {f.area ? f.area + " · " : ""}
                  {findingState(s, f)} ·{" "}
                  {dateLabel(
                    s.walkthroughs.find((x) => x.id === f.walkthroughId)
                      ?.date || w.date,
                  )}
                </small>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  update((d) => {
                    carryForward(d, f.id, w.id);
                  }, "Carried into this walkthrough")
                }
              >
                Carry forward <ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      <details className="card panel">
        <summary>
          <strong>Property maintenance record</strong>
        </summary>
        <PropertyRecord s={s} propertyId={w.propertyId} links />
      </details>
    </>
  );
}

/** One card, one decision: what this walkthrough needs from the operator now. */
function NextStep({
  s,
  walkthrough: w,
  totals,
  link,
  state,
  notify,
  update,
  openRequest,
  converted,
  blockers,
  send,
  onSite,
}: {
  s: State;
  walkthrough: Walkthrough;
  totals: ReturnType<typeof assessmentTotals>;
  link: string;
  state: LinkState;
  notify: Props["notify"];
  update: Props["update"];
  openRequest: Props["openRequest"];
  converted?: string;
  blockers: SendBlocker[];
  send: () => void;
  onSite: (mode: OnSiteMode) => void;
}) {
  const incomplete = new Set(blockers.map((b) => b.finding.id)).size;
  const leftover = undecided(s, w.id).length;
  const opens = w.access?.opens ?? [];
  const property = s.properties.find((p) => p.id === w.propertyId);
  const account = accounts.find((a) => a.id === property?.accountId);
  const people = contactsFor(account?.id || "").filter((c) => !c.inactiveAt);
  const copy = () =>
    navigator.clipboard
      ?.writeText(link)
      .then(() => notify("Assessment link copied"))
      .catch(() => notify(link));
  /* A link that no longer works is not offered, and the card says so
     (ADR 095). Once a fresh one replaces it, focus goes to Copy link, the
     next move. */
  const dead = state === "revoked" || state === "expired";
  const copyButton = useRef<HTMLButtonElement>(null);
  const handOn = useRef(false);
  useEffect(() => {
    if (handOn.current && state === "live") {
      handOn.current = false;
      copyButton.current?.focus();
    }
  }, [state]);

  if (w.status === "Converted")
    return (
      <section className="card panel op-decision op-tone-complete">
        <div className="op-decision-head">
          <h2 className="look-h3">Approved work is in the queue</h2>
          <p>
            {totals.approved.length} finding
            {totals.approved.length === 1 ? "" : "s"} became tasks on one
            request. Schedule it like any other job.
          </p>
          {leftover > 0 && (
            <p>
              {leftover} finding{leftover === 1 ? " was" : "s were"} left
              undecided when this went ahead. Your next walkthrough for this
              property offers {leftover === 1 ? "it" : "them"} under “Still open
              from earlier visits”.
            </p>
          )}
        </div>
        <div className="op-decision-actions">
          {converted && (
            <button className="primary" onClick={() => openRequest(converted)}>
              Open the request <ArrowRight aria-hidden="true" size={16} />
            </button>
          )}
        </div>
      </section>
    );

  if (w.status === "Sent")
    return (
      <section className="card panel op-decision">
        <div className="op-decision-head">
          <h2 className="look-h3">
            {totals.approved.length
              ? `${totals.approved.length} approved · ready to convert`
              : dead
                ? state === "revoked"
                  ? "Link withdrawn"
                  : "Link expired"
                : "Waiting on the customer"}
          </h2>
          <p>
            {totals.approved.length
              ? `${money(totals.subtotal)} plus ${money2(totals.tax)} tax.`
              : dead
                ? "The customer can’t open the assessment until you issue a fresh link."
                : "The customer opens the link below to review the findings. Nothing is scheduled until they approve and a payment method is on file."}
          </p>
        </div>
        {(totals.approved.length > 0 || !dead) && (
        <div className="op-decision-actions">
          {totals.approved.length > 0 && (
            <button
              className="primary"
              onClick={() =>
                update((d) => {
                  convertApproved(d, w.id);
                }, "Approved findings converted into work")
              }
            >
              Convert {totals.approved.length} approved
            </button>
          )}
          {!dead && (
            <>
              <button ref={copyButton} className="secondary" onClick={copy}>
                <Copy aria-hidden="true" size={16} /> Copy link
              </button>
              <button
                className="text-button"
                onClick={() => window.open(link)}
              >
                <ExternalLink aria-hidden="true" size={16} /> Open as the
                customer
                <span className="sr-only"> (opens in a new tab)</span>
              </button>
            </>
          )}
        </div>
        )}
        {/* Facts about the link, said plainly, not on tinted boxes
            (ADR 093). */}
        {totals.approved.length > 0 && leftover > 0 && (
          <p className="wt-fact">
            Converting now locks the customer’s page with {leftover} finding
            {leftover === 1 ? "" : "s"} still undecided. They are not lost: your
            next walkthrough for this property can carry{" "}
            {leftover === 1 ? "it" : "them"} forward.
          </p>
        )}
        {/* The one thing here the operator genuinely could not find out
            before: whether the assessment was ever opened. */}
        {/* With nothing approved, the heading already says it. */}
        {!(dead && !totals.approved.length) && (
        <p className="wt-fact">
          {state === "revoked"
            ? "This link has been withdrawn. Issue a fresh one if the customer still needs it."
            : state === "expired"
              ? "This link has expired. Issue a fresh one if the customer still needs it."
              : opens.length
                ? `Opened ${opens.length} time${opens.length === 1 ? "" : "s"} · last ${dateLabel(opens[opens.length - 1])}`
                : "Not opened yet."}
        </p>
        )}
        {/* Only an organization has a choice to make. An individual's sole
            contact approves their own work and there is nobody else it could
            be, so asking would be theatre. */}
        {people.length > 1 && (
          <>
            <p className="wt-fact">
              Who may approve for this account. Recording who approved is one
              thing; deciding who is allowed to is this.
            </p>
            <ul className="audit">
              {people.map((c) => (
                <li key={c.id}>
                  <label className="assessment-check">
                    <input
                      type="checkbox"
                      checked={mayApprove(s, account?.id || "", c.id)}
                      onChange={(e) =>
                        update((d) => {
                          setApprover(d, c.id, e.target.checked);
                        }, "Approval authority updated")
                      }
                    />
                    {c.name}
                    {c.role ? ` · ${c.role}` : ""}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <LinkControls
          live={state === "live"}
          primary={dead && !totals.approved.length}
          withdraw={() =>
            update((d) => {
              revokeAccess(d, w.id);
            }, "Link withdrawn")
          }
          fresh={() => {
            handOn.current = dead;
            update((d) => {
              issueAccess(d, w.id);
            }, "Fresh link issued");
          }}
        />
      </section>
    );

  return (
    <section className="card panel op-decision">
      <div className="op-decision-head">
        <h2 className="look-h3">
          {!totals.findings.length
            ? "Record what you saw"
            : incomplete
              ? `${incomplete} item${incomplete === 1 ? "" : "s"} to price`
              : "Ready to send"}
        </h2>
        <p>
          {!totals.findings.length
            ? "On site: a photo, a few words, the room. Pricing comes after."
            : incomplete
              ? "Each needs a title the customer can recognise, and either a price or a note that it needs further assessment."
              : `${totals.findings.length} finding${totals.findings.length === 1 ? "" : "s"} ready for the customer to review.`}
        </p>
      </div>
      {/* One lead action, chosen by what the draft needs next: capture when
          there is nothing, pricing while anything is unpriced, sending once
          nothing is. Capturing more stays one tap away after the first. */}
      <div className="op-decision-actions">
        {!totals.findings.length ? (
          <button className="primary" onClick={() => onSite("capture")}>
            <Camera aria-hidden="true" size={16} /> Start on site
          </button>
        ) : (
          <>
            {incomplete ? (
              <button className="primary" onClick={() => onSite("price")}>
                Price {incomplete} item{incomplete === 1 ? "" : "s"}
              </button>
            ) : (
              <button className="primary" onClick={send}>
                <Send aria-hidden="true" size={16} /> Send to customer
              </button>
            )}
            <button className="secondary" onClick={() => onSite("capture")}>
              <Camera aria-hidden="true" size={16} /> Continue on site
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Withdrawing the link, or replacing one that still works, breaks the link
 * the customer holds, and neither toast can undo it, so each asks first with
 * Keep it focused (ADR 093). A link that no longer works is replaced in one
 * step. Focus comes back to the button that asked, or to the one left.
 * When a dead link is all the card is about, replacing it is the card's one
 * move, so it is the primary (ADR 095).
 */
function LinkControls({
  live,
  primary = false,
  withdraw,
  fresh,
}: {
  live: boolean;
  primary?: boolean;
  withdraw: () => void;
  fresh: () => void;
}) {
  const [asking, setAsking] = useState<"" | "withdraw" | "fresh">("");
  const asked = useRef<"withdraw" | "fresh">("fresh");
  const prev = useRef(asking);
  const keep = useRef<HTMLButtonElement>(null);
  const withdrawButton = useRef<HTMLButtonElement>(null);
  const freshButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (prev.current === asking) return;
    prev.current = asking;
    if (asking) keep.current?.focus();
    else
      (asked.current === "withdraw"
        ? (withdrawButton.current ?? freshButton.current)
        : freshButton.current
      )?.focus();
  }, [asking]);
  const ask = (which: "withdraw" | "fresh") => {
    asked.current = which;
    setAsking(which);
  };
  if (asking)
    return (
      <fieldset className="job-outcomes actions">
        <legend>
          {asking === "withdraw"
            ? "Withdraw this link? The customer’s link stops working."
            : "Issue a fresh link? The customer’s current link stops working."}
        </legend>
        <div>
          <button
            className="secondary"
            onClick={() => {
              (asking === "withdraw" ? withdraw : fresh)();
              setAsking("");
            }}
          >
            {asking === "withdraw" ? "Withdraw link" : "Issue fresh link"}
          </button>
        </div>
        <button ref={keep} className="text-button" onClick={() => setAsking("")}>
          Keep it
        </button>
      </fieldset>
    );
  return (
    <div className="row actions">
      {live && (
        <button
          ref={withdrawButton}
          className="text-button"
          onClick={() => ask("withdraw")}
        >
          Withdraw this link
        </button>
      )}
      <button
        ref={freshButton}
        className={primary ? "primary" : "text-button"}
        onClick={() => (live ? ask("fresh") : fresh())}
      >
        Issue a fresh link
      </button>
    </div>
  );
}

function FindingCard({
  s,
  finding: f,
  editable,
  patch,
  attach,
  remove,
}: {
  s: State;
  finding: Finding;
  editable: boolean;
  patch: (id: string, values: Partial<Finding>, msg?: string) => void;
  attach: (f: Finding, file?: File) => Promise<boolean>;
  remove: () => void;
}) {
  const state = findingState(s, f);
  const [photoRejected, setPhotoRejected] = useState(false);
  const number = String(f.number).padStart(2, "0");
  return (
    <details
      id={"finding-" + f.id}
      className="card panel work-task wt-finding"
      open={editable}
    >
      <summary>
        <strong>
          {number} · {f.title || "Untitled finding"}
        </strong>
        {/* A draft has no decisions yet, so its findings carry no state. */}
        {!editable && (
          <span className={"badge " + findingTone(state, f)}>{state}</span>
        )}
      </summary>
      {editable ? (
        <>
          <div className="row">
            <label className="mini-field">
              Area / location
              <input
                value={f.area}
                placeholder="Main floor hallway"
                onChange={(e) => patch(f.id, { area: e.target.value })}
              />
            </label>
            <label className="mini-field">
              Short title
              <input
                value={f.title}
                placeholder="Door rubbing against frame"
                onChange={(e) => patch(f.id, { title: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            Observed condition
            <textarea
              value={f.observed}
              placeholder="What is visibly wrong, in plain language."
              onChange={(e) => patch(f.id, { observed: e.target.value })}
            />
          </label>
          <label className="field">
            Proposed work
            <textarea
              value={f.proposed}
              placeholder="The repair you would carry out. This becomes the task if approved."
              onChange={(e) => patch(f.id, { proposed: e.target.value })}
            />
          </label>
          <div className="photos">
            {f.photos.map((src, i) => (
              <img key={i} src={src} alt={`Finding ${number} condition`} />
            ))}
            <label
              className={"photo-add" + (photoRejected ? " field-error" : "")}
            >
              <Camera aria-hidden="true" size={16} /> Add photo
              <input
                type="file"
                accept="image/*"
                aria-invalid={photoRejected || undefined}
                onChange={async (e) =>
                  setPhotoRejected(!(await attach(f, e.target.files?.[0])))
                }
              />
            </label>
            {photoRejected && (
              <span className="field-message" role="alert">
                {unreadableMessage}
              </span>
            )}
          </div>
          <div className="row">
            <label className="mini-field">
              Pricing
              <select
                value={f.pricing}
                onChange={(e) =>
                  patch(f.id, {
                    pricing: e.target.value as Finding["pricing"],
                    ...(e.target.value === "Further Assessment Required"
                      ? { price: undefined }
                      : {}),
                  })
                }
              >
                <option>Quoted</option>
                <option value="Further Assessment Required">
                  Further assessment required
                </option>
              </select>
            </label>
            {f.pricing === "Quoted" && (
              <label className="mini-field">
                Estimated price (CAD)
                <input
                  type="number"
                  min="1"
                  value={f.price ?? ""}
                  onChange={(e) =>
                    patch(f.id, {
                      price: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
            )}
          </div>
          {f.pricing === "Further Assessment Required" && (
            <p className="note">
              The customer sees this as pending assessment, with no price and no
              approval control. It cannot become work until you scope it.
            </p>
          )}
          <label className="field">
            Note for the customer
            <input
              value={f.customerNotes}
              placeholder="Optional, shown on the assessment."
              onChange={(e) => patch(f.id, { customerNotes: e.target.value })}
            />
          </label>
          <label className="field">
            Internal note
            <input
              value={f.internalNotes}
              placeholder="Not shown to the customer."
              onChange={(e) => patch(f.id, { internalNotes: e.target.value })}
            />
          </label>
          <button className="text-button" onClick={remove}>
            <Trash2 aria-hidden="true" size={16} /> Remove finding
          </button>
        </>
      ) : (
        <>
          <small>{f.area}</small>
          <p>{f.observed}</p>
          <p>
            <strong>Proposed:</strong> {f.proposed}
          </p>
          <div className="photos">
            {f.photos.map((src, i) => (
              <img key={i} src={src} alt={`Finding ${number} condition`} />
            ))}
          </div>
          {/* An unpriced finding's chip already says it needs assessment. */}
          {f.pricing === "Quoted" && (
            <p>
              <strong>{money(f.price || 0)} + applicable tax</strong>
            </p>
          )}
          {f.customerNotes && <p className="note">{f.customerNotes}</p>}
          {f.followUpRequestedAt && (
            <p className="note">
              The customer asked for an assessment on{" "}
              {dateLabel(f.followUpRequestedAt)}. Scope and price it here, or
              carry it into a new walkthrough.
            </p>
          )}
        </>
      )}
    </details>
  );
}
