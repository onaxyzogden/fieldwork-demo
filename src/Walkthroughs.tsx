import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  AlertCircle,
  ClipboardCheck,
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
  assessmentTotals,
  convertApproved,
  createWalkthrough,
  findingState,
  findingsFor,
  money2,
  sendBlockers,
  sendWalkthrough,
} from "./pmw";
import { assessmentLink } from "./store";
import PropertyRecord from "./PropertyRecord";

type Props = {
  s: State;
  update: (fn: (d: State) => void, msg?: string) => void;
  notify: (msg: string) => void;
  openRequest: (id: string) => void;
};

const statusTone = (w: Walkthrough) =>
  w.status === "Converted" ? "green" : w.status === "Sent" ? "" : "neutral";

export default function Walkthroughs({
  s,
  update,
  notify,
  openRequest,
}: Props) {
  const [openId, setOpenId] = useState("");
  const open = s.walkthroughs.find((w) => w.id === openId);
  return open ? (
    <WalkthroughDetail
      s={s}
      walkthrough={open}
      update={update}
      notify={notify}
      openRequest={openRequest}
      back={() => setOpenId("")}
    />
  ) : (
    <WalkthroughList s={s} update={update} notify={notify} open={setOpenId} />
  );
}

function WalkthroughList({
  s,
  update,
  notify,
  open,
}: {
  s: State;
  update: Props["update"];
  notify: Props["notify"];
  open: (id: string) => void;
}) {
  const { fail, clear, fieldClass, invalid, Message } = useFieldErrors();
  const [creating, setCreating] = useState(false);
  const [propertyId, setPropertyId] = useState(s.properties[0]?.id || "");
  const [mergeNote, setMergeNote] = useState("");
  const duplicates = duplicateProperties(s);
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
  const groups = [
    ["Draft", "In progress"],
    ["Sent", "With the customer"],
    ["Converted", "Became work"],
  ] as const;

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
    }, "Walkthrough started");
    setCreating(false);
    setAddress("");
    open(id);
  };

  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">PROACTIVE MAINTENANCE</span>
          <h1>Property walkthroughs</h1>
          <p>
            Walk a property, record what you see, and let the customer choose
            what to approve.
          </p>
        </div>
        <button className="primary" onClick={() => setCreating(!creating)}>
          <Plus size={16} /> New walkthrough
        </button>
      </div>
      {/* A detector nothing renders is ADR 034's defect. This is where
          duplicates are made — an operator typing an address that already
          exists — so it is where they are shown. */}
      {duplicates.length > 0 && (
        <section className="card panel">
          <div className="panel-title">
            <h3>Possible duplicate properties</h3>
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
                  <AlertCircle size={16} /> These are held by different
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
        <section className="card panel">
          <div className="panel-title">
            <h3>Start a walkthrough</h3>
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
              <label className={fieldClass("address")}>
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
                <Message field="address" />
              </label>
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
            Start walkthrough <ArrowRight size={16} />
          </button>
        </section>
      )}
      {!s.walkthroughs.length && !creating && (
        <section className="card panel">
          <p className="note">
            No walkthroughs yet. Start one to record findings against a
            property.
          </p>
        </section>
      )}
      {groups.map(([status, caption]) => {
        const rows = s.walkthroughs.filter((w) => w.status === status);
        if (!rows.length) return null;
        return (
          <section className="card panel" key={status}>
            <div className="panel-title">
              <h3>{caption}</h3>
              <span className="count">{rows.length}</span>
            </div>
            {rows.map((w) => {
              const property = s.properties.find((p) => p.id === w.propertyId);
              const totals = assessmentTotals(s, w.id);
              return (
                <button
                  className="queue-item"
                  key={w.id}
                  onClick={() => open(w.id)}
                >
                  <p>
                    <strong>{w.assessmentId}</strong>
                    <span className={"badge " + statusTone(w)}>{w.status}</span>
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
  back,
}: {
  s: State;
  walkthrough: Walkthrough;
  update: Props["update"];
  notify: Props["notify"];
  openRequest: Props["openRequest"];
  back: () => void;
}) {
  const property = s.properties.find((p) => p.id === w.propertyId);
  const totals = assessmentTotals(s, w.id);
  const findings = findingsFor(s, w.id);
  const draft = w.status === "Draft";
  /* What earlier visits to this property left unresolved. Only while this one
     is still a draft: carrying into a sent assessment would change what the
     customer is already looking at. */
  const carryable = carryCandidates(s, w.id);
  /* What is standing between this assessment and the customer, and whether the
     operator has asked to send yet. Incomplete is the normal state of a card
     being filled in, so the messages appear on the first attempt, not before. */
  const blockers = sendBlockers(s, w.id);
  const [revealed, setRevealed] = useState(false);
  const send = () => {
    if (!totals.findings.length) return setRevealed(true);
    if (blockers.length) return setRevealed(true);
    update((d) => {
      sendWalkthrough(d, w.id);
    }, "Assessment sent to the customer");
  };
  const converted = s.requests.find((r) => r.walkthroughId === w.id);
  const link = assessmentLink(w.assessmentId);

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
        <ArrowLeft size={16} /> All walkthroughs
      </button>
      <div className="heading">
        <div>
          <span className="eyebrow">ASSESSMENT {w.assessmentId}</span>
          <h1>
            {property?.address}, {property?.city}
          </h1>
          <p>
            {accountName(property?.accountId || "")} ·{" "}
            {dateLabel(w.sentAt || w.date)}
          </p>
        </div>
        <span className={"badge " + statusTone(w)}>{w.status}</span>
      </div>

      <NextStep
        s={s}
        walkthrough={w}
        totals={totals}
        link={link}
        notify={notify}
        update={update}
        openRequest={openRequest}
        converted={converted?.id}
        blockers={blockers}
        send={send}
        revealedEmpty={revealed && !totals.findings.length}
      />

      {findings.map((f) => (
        <FindingCard
          key={f.id}
          s={s}
          finding={f}
          editable={draft}
          patch={patch}
          attach={attach}
          blockers={
            revealed
              ? blockers
                  .filter((b) => b.finding.id === f.id)
                  .map((b) => b.reason)
              : []
          }
          remove={() =>
            update((d) => {
              d.findings = d.findings.filter((x) => x.id !== f.id);
            }, "Finding removed")
          }
        />
      ))}

      {draft && (
        <button
          className="secondary full actions"
          onClick={() =>
            update((d) => {
              addFinding(d, w.id);
            }, "Finding added")
          }
        >
          <Plus size={16} /> Add finding
        </button>
      )}
      {draft && !!carryable.length && (
        <section className="card panel">
          <div className="panel-title">
            <h3>Still open from earlier visits</h3>
            <span className="count">{carryable.length}</span>
          </div>
          <p className="note">
            Items the customer deferred, and items that needed a closer look.
            Carrying one restates it here, with its own price and its own
            decision, and marks the original as superseded.
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
                Carry forward <ArrowRight size={16} />
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
  notify,
  update,
  openRequest,
  converted,
  blockers,
  send,
  revealedEmpty,
}: {
  s: State;
  walkthrough: Walkthrough;
  totals: ReturnType<typeof assessmentTotals>;
  link: string;
  notify: Props["notify"];
  update: Props["update"];
  openRequest: Props["openRequest"];
  converted?: string;
  blockers: SendBlocker[];
  send: () => void;
  /** The operator pressed send with nothing recorded yet. */
  revealedEmpty: boolean;
}) {
  const incomplete = new Set(blockers.map((b) => b.finding.id)).size;
  const copy = () =>
    navigator.clipboard
      ?.writeText(link)
      .then(() => notify("Assessment link copied"))
      .catch(() => notify(link));

  if (w.status === "Converted")
    return (
      <section className="card panel op-decision op-tone-complete">
        <div className="op-decision-head">
          <h3>Approved work is in the queue</h3>
          <p>
            {totals.approved.length} finding
            {totals.approved.length === 1 ? "" : "s"} became tasks on one
            request. Schedule it like any other job.
          </p>
        </div>
        <div className="op-decision-actions">
          {converted && (
            <button className="primary" onClick={() => openRequest(converted)}>
              Open the request <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    );

  if (w.status === "Sent")
    return (
      <section className="card panel op-decision">
        <div className="op-decision-head">
          <h3>
            {totals.approved.length
              ? `${totals.approved.length} approved · ready to convert`
              : "Waiting on the customer"}
          </h3>
          <p>
            {totals.approved.length
              ? `${money(totals.subtotal)} plus ${money2(totals.tax)} tax.`
              : "The customer opens the link below to review the findings. Nothing is scheduled until they approve and a payment method is on file."}
          </p>
        </div>
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
          <button className="secondary" onClick={copy}>
            <Copy size={16} /> Copy link
          </button>
          <button className="text-button" onClick={() => window.open(link)}>
            <ExternalLink size={16} /> Open as the customer
          </button>
        </div>
      </section>
    );

  return (
    <section className="card panel op-decision">
      <div className="op-decision-head">
        <h3>
          {!totals.findings.length
            ? "Record what you saw"
            : incomplete
              ? `${incomplete} finding${incomplete === 1 ? "" : "s"} not ready to send`
              : "Ready to send"}
        </h3>
        <p>
          {!totals.findings.length
            ? "Add one finding per issue. Each is approved or deferred on its own."
            : incomplete
              ? "Each needs a title the customer can recognise, and either a price or a note that it needs further assessment."
              : `${totals.findings.length} finding${totals.findings.length === 1 ? "" : "s"} ready for the customer to review.`}
        </p>
      </div>
      {revealedEmpty && (
        <span className="field-message" role="alert">
          Add at least one finding before sending.
        </span>
      )}
      <div className="op-decision-actions">
        <button className="primary" onClick={send}>
          <Send size={16} /> Send to customer
        </button>
      </div>
    </section>
  );
}

function FindingCard({
  s,
  finding: f,
  editable,
  patch,
  attach,
  remove,
  blockers,
}: {
  s: State;
  finding: Finding;
  editable: boolean;
  patch: (id: string, values: Partial<Finding>, msg?: string) => void;
  attach: (f: Finding, file?: File) => Promise<boolean>;
  remove: () => void;
  /* Only after the operator has tried to send: a card being incomplete while
     it is still being filled in is not an error, it is a card being filled
     in. */
  blockers?: SendBlocker["reason"][];
}) {
  const state = findingState(s, f);
  const [photoRejected, setPhotoRejected] = useState(false);
  const blocked = (reason: SendBlocker["reason"]) =>
    (blockers || []).includes(reason);
  const number = String(f.number).padStart(2, "0");
  return (
    <details className="card panel work-task" open={editable}>
      <summary>
        <strong>
          {number} · {f.title || "Untitled finding"}
        </strong>
        <span className="badge">{state}</span>
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
            <label
              className={
                "mini-field" + (blocked("title") ? " field-error" : "")
              }
            >
              Short title
              <input
                value={f.title}
                placeholder="Door rubbing against frame"
                aria-invalid={blocked("title") || undefined}
                onChange={(e) => patch(f.id, { title: e.target.value })}
              />
              {blocked("title") && (
                <span className="field-message" role="alert">
                  The customer sees this as the name of the work. Give it one
                  before sending.
                </span>
              )}
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
              <Camera size={16} /> Add photo
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
                <option>Further Assessment Required</option>
              </select>
            </label>
            {f.pricing === "Quoted" && (
              <label
                className={
                  "mini-field" + (blocked("price") ? " field-error" : "")
                }
              >
                Estimated price (CAD)
                <input
                  type="number"
                  min="1"
                  value={f.price ?? ""}
                  aria-invalid={blocked("price") || undefined}
                  onChange={(e) =>
                    patch(f.id, {
                      price: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
                {blocked("price") && (
                  <span className="field-message" role="alert">
                    Price it, or mark it as further assessment required.
                  </span>
                )}
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
            <Trash2 size={16} /> Remove finding
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
          <p>
            {f.pricing === "Quoted" ? (
              <strong>{money(f.price || 0)} + applicable tax</strong>
            ) : (
              <span className="badge neutral">
                <ClipboardCheck size={16} /> Assessment required
              </span>
            )}
          </p>
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
