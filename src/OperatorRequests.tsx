import { AuditList } from "./QueueAside";
import { bucket } from "./work";
import { reviewTask } from "./decisions";
import { suggestTitle } from "./pmw";
import { dayLabel } from "./intake";
import { getIssue } from "./clarification";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  MapPin,
  Clock,
  Search,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  type Request,
  providers,
  money,
  dateLabel,
  log,
  chosenStart,
  available,
  eligible,
  genericTitle,
  materialsResponsibilities,
  type MaterialsResponsibility,
  confirmed,
} from "./model";
import { unreachable } from "./notifications";
import { TaskAnswers } from "./RequestFields";
import { useWorkspace } from "./workspaceContext";

/** The operator's Requests page: the queue, a request's detail and fulfillment (ADR 077). */
export function OperatorRequests() {
  const {
    Message,
    assignPay,
    badge,
    cancelVisit,
    candidates,
    choose,
    chosenTime,
    clear,
    createVisit,
    decisionCard,
    duration,
    fieldClass,
    filter,
    fulfillment,
    fulfillmentKind,
    idPrefix,
    invalid,
    invalidate,
    liveVisits,
    match,
    notify,
    opts,
    patchTask,
    provider,
    r,
    requestStatus,
    s,
    scopeTasks,
    search,
    selected,
    setContractor,
    setFilter,
    setFulfillment,
    setModal,
    setOverride,
    setPage,
    setPay,
    setPayTouched,
    setProvider,
    setRequestTab,
    setRole,
    setSearch,
    setSelected,
    setShowRequestQueue,
    setSlot,
    setTaskTitles,
    showRequestQueue,
    showTasks,
    slot,
    tab,
    taskPhotos,
    taskTitles,
    tasks,
    trail,
    update,
    visitCard,
    visits,
  } = useWorkspace();
  return (
    <>
      <div
        className={
          "heading operator-request-heading " + (fulfillment ? "is-hidden" : "")
        }
      >
        <div>
          <div className="eyebrow">INTAKE & FULFILLMENT</div>
          <h1>Service requests</h1>
          <p>The right work. The right person. The right time.</p>
        </div>
        <span className="badge">{s.requests.length} requests</span>
      </div>
      <div
        className={
          "requests-layout operator-concept " +
          (fulfillment ? "focused-fulfillment" : "")
        }
      >
        {!fulfillment && (
          <button
            className="secondary mobile-request-browser"
            aria-expanded={showRequestQueue}
            onClick={() => setShowRequestQueue(!showRequestQueue)}
          >
            {showRequestQueue ? "Close request list" : "Browse requests"}
          </button>
        )}
        <section
          className={"panel queue " + (showRequestQueue ? "queue-open" : "")}
        >
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Search requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter requests"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "All requests",
              "Needs Action",
              "Waiting",
              "Scheduled",
              "Draft",
              "History",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {s.requests
            .filter(
              (q) =>
                (filter === "All requests" || bucket(s, q.id) === filter) &&
                (
                  q.name +
                  q.city +
                  s.tasks
                    .filter((t) => t.requestId === q.id)
                    .map((t) => t.description)
                    .join()
                )
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((q) => (
              <button
                key={q.id}
                className={"queue-item " + (q.id === r.id ? "selected" : "")}
                onClick={() => choose(q.id)}
              >
                <div className="row between">
                  <strong>{q.name}</strong>
                  <small>{q.id.toUpperCase()}</small>
                </div>
                <p>
                  <span>
                    <MapPin size={16} />
                    {q.city} ·{" "}
                    {
                      s.tasks.filter(
                        (t) => t.requestId === q.id && !t.mergedInto,
                      ).length
                    }{" "}
                    tasks
                  </span>
                  {badge(requestStatus(q.id))}
                </p>
              </button>
            ))}
        </section>
        <div className="detail">
          <div className="operator-detail-header">
            <button className="secondary" onClick={() => setPage("Home")}>
              ← Back to Home
            </button>
            <strong>Request Details</strong>
          </div>
          <section className="card panel operator-summary">
            <div className="panel-title">
              <div>
                <span className="eyebrow">
                  SERVICE REQUEST / {r.id.toUpperCase()}
                </span>
                <h2>{r.address || r.name}</h2>
                <p>
                  <MapPin size={16} /> {r.city} · {r.name}
                </p>
              </div>
              {badge(requestStatus(r.id))}
            </div>
            <div className="detail-meta">
              <span>
                <Clock size={16} />
                {r.timing}
              </span>
              <span>{badge(r.mode)}</span>
            </div>
            <p>
              {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
              {tasks.reduce((n, t) => n + t.duration, 0)} minutes estimated ·{" "}
              {tasks.reduce((n, t) => n + t.photos.length, 0)} photos
            </p>
            <a
              className="text-button"
              target="_blank"
              rel="noreferrer"
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(r.address + ", " + r.city)
              }
            >
              {r.address}, {r.city} · Open in Maps ↗
            </a>
          </section>
          {decisionCard()}
          {/* A bounce is the one delivery state the operator can act
              on: reach that person another way (ADR 060). */}
          {unreachable(s, r.id).map((u) => (
            <p className="warning" key={u.name + u.channel}>
              <AlertCircle size={16} />
              {u.channel === "sms"
                ? `Couldn’t text ${u.name}: ${u.reason.toLowerCase()}. Call or email them about this request.`
                : `Couldn’t email ${u.name}: ${u.reason.toLowerCase()}. Call or text them about this request.`}
            </p>
          ))}
          {r.operatorNote && (
            /* Single Q&A slot: waiting, then answered. Asking again
               replaces it rather than growing a history. */
            <section
              id={idPrefix + "question"}
              className={
                "card operator-note " +
                (r.customerReply ? "answered" : "waiting")
              }
            >
              <span className="eyebrow">
                {r.customerReply ? "CUSTOMER ANSWERED" : "WAITING ON CUSTOMER"}
              </span>
              <p>{r.operatorNote}</p>
              {r.customerReply ? (
                <p className="operator-note-reply">
                  <strong>Reply:</strong> {r.customerReply}
                </p>
              ) : (
                <button
                  className="text-button"
                  onClick={() =>
                    update((d) => {
                      const req = d.requests.find((x) => x.id === r.id)!;
                      req.operatorNote = null;
                      req.customerReply = null;
                    }, "Question withdrawn")
                  }
                >
                  Cancel question
                </button>
              )}
            </section>
          )}
          {/* Everything but the decision, one part at a time (ADR 068).
              The part that matters opens first: the tasks until the
              work is booked, then its visits. */}
          <div className="request-tabs">
            <div
              className="segmented"
              role="group"
              aria-label="Request details"
            >
              {(
                [
                  ["Tasks", tasks.length],
                  ["Visits", liveVisits.length],
                  ["Notes"],
                  ["History", trail.length],
                ] as [string, number?][]
              ).map(([name, n]) => (
                <button
                  key={name}
                  className={tab === name ? "chosen" : ""}
                  aria-pressed={tab === name}
                  onClick={() => setRequestTab(name)}
                >
                  {name}
                  {n !== undefined && <span className="count">{n}</span>}
                </button>
              ))}
            </div>
            {tab === "Tasks" && (
              <section className="card panel" id="review-tasks">
                <div className="panel-title">
                  <h3>
                    Tasks <span className="count">{tasks.length}</span>
                  </h3>
                  <small>Select tasks to group into a separate visit</small>
                </div>
                {tasks.map((t) => (
                  <details className="task-review" key={t.id}>
                    <summary>
                      <span className="task-number">
                        {tasks.indexOf(t) + 1}
                      </span>{" "}
                      {t.summary} · {t.duration} min
                      {!t.reviewed ? " · Needs review" : ""}
                    </summary>
                    <div className="row between">
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={selected.includes(t.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, t.id]
                                : selected.filter((x) => x !== t.id),
                            )
                          }
                        />
                        <strong>{t.summary}</strong>
                      </label>
                      <span className="badge">{t.duration} min</span>
                    </div>
                    <p>“{t.description}”</p>
                    <TaskAnswers task={t} />
                    {t.restricted && (
                      <p className="warning">
                        <AlertCircle size={16} /> Potential regulated work ·
                        operator review and eligible specialist required
                      </p>
                    )}
                    {/* Set where the scope is decided. "Materials
                          required" as a visit outcome is a stall until
                          somebody has said whose materials they are. */}
                    <label className="field">
                      Materials
                      <select
                        value={t.materials || "To be confirmed"}
                        onChange={(e) =>
                          update((d) => {
                            const task = d.tasks.find((x) => x.id === t.id)!;
                            const was = task.materials;
                            task.materials = e.target
                              .value as MaterialsResponsibility;
                            log(d, `Materials set for ${t.summary}`, {
                              actor: "Operator",
                              requestId: r.id,
                              entity: "task",
                              entityId: t.id,
                              field: "materials",
                              ...(was ? { from: was } : {}),
                              to: task.materials,
                            });
                          }, "Materials responsibility set")
                        }
                      >
                        {materialsResponsibilities.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    {taskPhotos(t)}
                    {/* A task the classifier could not name gets a
                          title here, prefilled from the customer's own
                          words (ADR 063). It heads the contractor's offer. */}
                    {!t.reviewed && genericTitle(t) && (
                      <label className="field">
                        Title
                        <input
                          value={
                            taskTitles[t.id] ?? suggestTitle(t.description)
                          }
                          onChange={(e) =>
                            setTaskTitles({
                              ...taskTitles,
                              [t.id]: e.target.value,
                            })
                          }
                        />
                      </label>
                    )}
                    {!t.reviewed && (
                      <button
                        className="secondary actions"
                        onClick={() =>
                          update((d) => {
                            reviewTask(d, t.id, taskTitles[t.id]);
                          }, "Review recorded")
                        }
                      >
                        Mark reviewed
                      </button>
                    )}
                    {/* Explainability and scope authoring stay reachable
                          but out of the triage path. */}
                    <details className="note">
                      <summary>Why this classification?</summary>
                      <div className="reason">
                        <ShieldCheck size={16} />
                        <span>
                          {t.reason}
                          <small>
                            Confidence {Math.round(t.confidence * 100)}% ·{" "}
                            {t.category}
                          </small>
                        </span>
                      </div>
                    </details>
                    <details className="note">
                      <summary>Adjust scope</summary>
                      <p>
                        Reclassifying to restricted work clears the review flag
                        and returns this request to Needs Review.
                      </p>
                      <div className="row wrap actions">
                        <label className="mini-field">
                          Classification
                          <select
                            aria-label={"Classification for " + t.summary}
                            value={t.category}
                            onChange={(e) =>
                              update((d) => {
                                const task = d.tasks.find(
                                  (x) => x.id === t.id,
                                )!;
                                log(
                                  d,
                                  `Classification corrected: ${task.category} → ${e.target.value} · original: ${task.description}`,
                                );
                                task.category = e.target.value;
                                task.restricted =
                                  task.restricted ||
                                  e.target.value.includes("Electrical");
                                task.reviewed = !task.restricted;
                              }, "Correction recorded")
                            }
                          >
                            <option>{t.category}</option>
                            {[
                              "Handyman / Doors / Adjustment",
                              "Handyman / Walls / Drywall",
                              "Installation / Shelving",
                              "Assembly / Furniture",
                              "Electrical / Restricted work",
                            ]
                              .filter((x) => x !== t.category)
                              .map((x) => (
                                <option key={x}>{x}</option>
                              ))}
                          </select>
                        </label>
                        <label
                          className={fieldClass(
                            "duration-" + t.id,
                            "mini-field",
                          )}
                        >
                          Duration (min)
                          <input
                            type="number"
                            min="15"
                            max="480"
                            value={t.duration}
                            {...invalid("duration-" + t.id)}
                            onChange={(e) => {
                              if (
                                visits.some(
                                  (v) =>
                                    v.status !== "Cancelled" &&
                                    v.taskIds.includes(t.id),
                                )
                              )
                                return invalidate(
                                  "duration-" + t.id,
                                  "Remove the visit before changing this duration, so availability can be recalculated.",
                                );
                              clear("duration-" + t.id);
                              patchTask(t.id, {
                                duration: Math.max(15, Number(e.target.value)),
                              });
                            }}
                          />
                          <Message field={"duration-" + t.id} />
                        </label>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected([t.id]);
                            setModal("Split task");
                          }}
                        >
                          Split task
                        </button>
                      </div>
                    </details>
                  </details>
                ))}
                {selected.length > 1 && (
                  <button
                    className="secondary"
                    onClick={() => setModal("Merge tasks")}
                  >
                    Merge selected task descriptions
                  </button>
                )}
              </section>
            )}
            {tab === "Visits" && (
              <section className="card panel" aria-label="Visits">
                {liveVisits.length === 0 && (
                  <p>No visits yet. Booked and offered visits show here.</p>
                )}
                {visits
                  .filter((v) => v.status !== "Cancelled")
                  .map((v) => (
                    <div key={v.id}>
                      {visitCard(v)}
                      {s.assignments
                        .filter((a) => a.visitId === v.id)
                        .map((a) => (
                          <div className="assignment-row" key={a.id}>
                            <span>
                              {
                                providers.find((p) => p.id === a.providerId)
                                  ?.name
                              }{" "}
                              ·{" "}
                              {a.providerId === "yousef"
                                ? "Self-assigned"
                                : money(a.pay)}
                            </span>
                            {badge(a.status)}
                            {a.status === "Offered" && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setContractor(a.providerId);
                                  setRole("Contractor");
                                  setPage("Your Work");
                                }}
                              >
                                Open contractor view <ArrowUpRight size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      <button
                        className="text-button"
                        onClick={() => cancelVisit(v)}
                      >
                        Remove visit / regroup tasks
                      </button>
                    </div>
                  ))}
              </section>
            )}
            {tab === "Notes" && (
              <section className="card panel operator-notes">
                <h3>Notes from customer</h3>
                <p>
                  {r.notes || "No additional access or parking notes supplied."}
                </p>
                {!!r.preferredSlots?.length || r.timingConstraints ? (
                  <>
                    <h3>Stated preference</h3>
                    <p>
                      {r.preferredSlots
                        ?.map(
                          (p) =>
                            `${dayLabel(p.date)}${p.times.length ? ` (${p.times.join(", ")})` : ""}`,
                        )
                        .join(" · ") || "No specific day"}
                      {r.timingConstraints ? ` — ${r.timingConstraints}` : ""}
                    </p>
                  </>
                ) : null}
              </section>
            )}
            {tab === "History" && (
              <section className="card panel" aria-label="History">
                {trail.length === 0 ? (
                  <p>Nothing recorded against this request yet.</p>
                ) : (
                  <AuditList trail={trail} />
                )}
              </section>
            )}
          </div>
          {fulfillment && (
            <>
              {" "}
              <section className="card panel" id="fulfillment">
                <button
                  className="secondary"
                  onClick={() => {
                    setFulfillment(false);
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLElement>("#decision button")
                        ?.focus(),
                    );
                  }}
                >
                  ← Back to request
                </button>
                <div className="panel-title">
                  <h2>
                    {fulfillmentKind === "self"
                      ? "Do It Myself"
                      : "Assign Contractor"}
                  </h2>
                  <span className="badge">
                    {selected.length || tasks.length} tasks · {duration} min
                  </span>
                </div>
                <div className="fulfillment-request-summary">
                  <MapPin size={24} />
                  <strong>
                    {r.address}, {r.city}
                  </strong>
                  <p>{scopeTasks.map((t) => t.summary).join(" · ")}</p>
                  <p>{r.timing}</p>
                </div>
                <Message field="tasks" />
                <Message field="provider" />
                <div className="provider-options">
                  {candidates.map((c) => {
                    const theirs = chosenStart(s, r, c.provider.id, duration);
                    return (
                      <button
                        key={c.provider.id}
                        aria-pressed={provider === c.provider.id}
                        className={
                          "provider-card " +
                          (provider === c.provider.id ? "selected" : "")
                        }
                        onClick={() => {
                          clear("provider");
                          clear("pay");
                          setProvider(c.provider.id);
                          // Each contractor's own rate, not the last one's.
                          setPayTouched(false);
                          setSlot("");
                          setOverride("");
                        }}
                      >
                        <div className="avatar">{c.provider.initials}</div>
                        <div>
                          <strong>{c.provider.name}</strong>
                          <small>
                            {c.provider.city} · {money(c.provider.rate)}
                            /hr
                          </small>
                          <small>
                            {c.match.checks.map((x) => x.title).join(" · ")}
                          </small>
                          <small>
                            {/* Agrees with the list below, which puts
                              the customer's time first (ADR 072). */}
                            {theirs
                              ? `Customer’s choice: ${dateLabel(theirs)} · ${c.provider.city === r.city ? 8 : 24} min simulated travel`
                              : c.appointments.length
                                ? `First fitting time: ${dateLabel(c.appointments[0].start)} · ${c.appointments[0].travel} min simulated travel`
                                : "No fitting time found"}
                          </small>
                        </div>
                        {provider === c.provider.id && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
                {!candidates.length && (
                  <div className="warning">
                    <strong>
                      {scopeTasks.some(
                        (t) =>
                          getIssue(t.description).availability ===
                          "Referral only",
                      )
                        ? "Referral-only scope: no bookable provider"
                        : scopeTasks.some((t) => !t.reviewed)
                          ? "Review these tasks before choosing a provider"
                          : "No provider covers all selected tasks"}
                    </strong>
                    <p>
                      Expand the task rows to review scope or select tasks for
                      separate visits.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setFulfillment(false);
                        showTasks();
                      }}
                    >
                      Review tasks / split visit
                    </button>
                  </div>
                )}
                {match.eligible && (
                  <details className="note">
                    <summary>Why this provider?</summary>
                    <ul>
                      {match.checks.map((c) => (
                        <li key={c.taskId}>
                          <strong>{c.title}</strong> — {c.reason}.{" "}
                          <small>{c.category}</small>
                        </li>
                      ))}
                    </ul>
                    <p>
                      {candidates.find((c) => c.provider.id === provider)
                        ?.appointments.length
                        ? "Fitting times below account for combined duration, working hours, existing visits, travel and buffers."
                        : "Scope fits, but no appointment fits the current duration and timing preference. Review timing or split the visit."}
                    </p>
                    <p>Customer price and contractor pay remain separate.</p>
                  </details>
                )}
                <h4>
                  Recommended appointments{" "}
                  <span className="muted">· simulated routing</span>
                </h4>
                <Message field="slot" />
                <div className="slot-grid">
                  {opts.map((o, i) => (
                    <button
                      key={o.start}
                      className={
                        "slot " +
                        ((slot || opts[0]?.start) === o.start ? "selected" : "")
                      }
                      onClick={() => {
                        clear("slot");
                        setSlot(o.start);
                      }}
                    >
                      {o.start === chosenTime ? (
                        <span className="eyebrow">CUSTOMER’S CHOICE</span>
                      ) : (
                        i === 0 && (
                          <span className="eyebrow">BEST ROUTE FIT</span>
                        )
                      )}
                      <strong>{dateLabel(o.start)}</strong>
                      <small>+{o.travel} min driving · 15 min buffer</small>
                      <small>
                        {duration} min work · fits provider schedule and
                        customer preference
                      </small>
                    </button>
                  ))}
                </div>
                {!!opts.length && (
                  <details className="note">
                    <summary>Why this time?</summary>
                    <p>
                      {(slot || opts[0]?.start) === chosenTime &&
                        "The customer chose this time when they booked. "}
                      {duration} minutes of work fits this provider’s weekday
                      working hours. Simulated travel allowance:{" "}
                      {opts.find((o) => o.start === (slot || opts[0]?.start))
                        ?.travel ?? opts[0]?.travel}{" "}
                      minutes, plus a 15-minute buffer. Checked against this
                      provider’s existing visits and the customer’s timing
                      preference.
                    </p>
                  </details>
                )}
                {!opts.length && (
                  <p className="warning">
                    No available window fits these tasks. Split the visit or
                    change provider.
                  </p>
                )}
                <label className="mini-field actions">
                  Override proposed time
                  <input
                    type="datetime-local"
                    onChange={(e) => {
                      const x = new Date(e.target.value);
                      if (!Number.isFinite(+x)) return;
                      if (
                        available(
                          s,
                          provider,
                          duration,
                          r.city,
                          x.toISOString(),
                          undefined,
                          r.timing,
                          r.id,
                        )
                      ) {
                        setOverride(x.toISOString());
                        setSlot(x.toISOString());
                        notify(
                          "Valid override selected; travel and buffers checked.",
                        );
                      } else
                        notify(
                          "That time conflicts with working hours, preferences, or an existing visit.",
                        );
                    }}
                  />
                </label>
                {provider !== "yousef" && (
                  <label className="mini-field">
                    Contractor pay (CAD)
                    <input
                      type="number"
                      min="0"
                      value={assignPay}
                      {...invalid("pay")}
                      onChange={(e) => {
                        clear("pay");
                        setPayTouched(true);
                        setPay(Math.max(0, +e.target.value));
                      }}
                    />
                    <Message field="pay" />
                  </label>
                )}
                <div className="note">
                  <strong>Customer price & confirmation</strong>
                  <p>
                    {s.quotes
                      .filter(
                        (q) =>
                          q.requestId === r.id && q.status !== "Superseded",
                      )
                      .map((q) => `${q.type}: ${money(q.amount)} · ${q.status}`)
                      .join("; ") ||
                      "No quote sent yet. Send it from the request once this visit is assigned."}
                  </p>
                  <p>
                    An offer does not confirm the customer appointment.
                    Acceptance, approved scope, quote approval and applicable
                    payment conditions still apply.
                  </p>
                </div>
                <button
                  className="primary actions"
                  onClick={() => {
                    if (!match.eligible)
                      return invalidate(
                        "provider",
                        "This provider is not eligible for every selected task.",
                      );
                    if (!opts.length)
                      return invalidate(
                        "slot",
                        "No appointment fits this scope. Adjust the tasks or choose another provider.",
                      );
                    createVisit();
                  }}
                >
                  {provider === "yousef"
                    ? "Create visit"
                    : "Create visit & send offer"}
                  <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
