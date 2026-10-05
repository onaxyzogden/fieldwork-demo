import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  type Finding,
  type PropertyType,
  type State,
  type Walkthrough,
  PROPERTY_TYPES,
} from "./model";
import {
  addFinding,
  carryCandidates,
  findingState,
  findingsFor,
  money2,
  named,
  needsPricing,
  quotable,
  roomsFor,
  sendBlockers,
  sendWalkthrough,
  suggestTitle,
} from "./pmw";
import { storablePhoto, unreadableMessage } from "./photos";
import { useFieldErrors } from "./fields";
import "./onsite.css";

/**
 * The walkthrough as it is actually done: standing in a room with a phone.
 *
 * Two modes, each the only thing on the screen. Capture asks for what a person
 * on site can give without stopping — a photo, a sentence, which room — and
 * nothing that needs a desk: no title, no price. Pricing comes after, one
 * finding at a time. A capture is an ordinary Finding with no title and no
 * price, so the send rule (ADR 028) already holds it back until it is priced;
 * this screen adds no gate of its own.
 */
export type OnSiteMode = "capture" | "price";

type Update = (fn: (d: State) => void, msg?: string) => void;

const TYPE_LABEL: Record<PropertyType, string> = {
  House: "House",
  Townhouse: "Townhouse",
  Condo: "Condo / apartment",
  Commercial: "Commercial",
};

export default function OnSite({
  s,
  walkthrough: w,
  mode,
  update,
  setMode,
  exit,
}: {
  s: State;
  walkthrough: Walkthrough;
  mode: OnSiteMode;
  update: Update;
  setMode: (mode: OnSiteMode) => void;
  exit: () => void;
}) {
  const property = s.properties.find((p) => p.id === w.propertyId);
  const ref = useRef<HTMLDivElement>(null);
  const top = () => ref.current?.scrollTo({ top: 0 });
  /* The overlay is the page while it is open; the document behind it should
     not scroll underneath a thumb. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  /* Focus starts inside the layer, on its heading, unless a field has already
     claimed it — the pricing step opens on its price box. */
  useEffect(() => {
    if (ref.current?.contains(document.activeElement)) return;
    ref.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [mode]);

  return (
    <div
      className="onsite"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "capture" ? "On site" : "Price items"}
      ref={ref}
    >
      {mode === "capture" && property && !property.type ? (
        <TypePicker
          address={property.address}
          choose={(type) =>
            update((d) => {
              const p = d.properties.find((x) => x.id === property.id);
              if (p) p.type = type;
            })
          }
          exit={exit}
        />
      ) : mode === "capture" ? (
        <Capture
          s={s}
          walkthrough={w}
          update={update}
          top={top}
          finish={(saved) =>
            saved || needsPricing(s, w.id).length ? setMode("price") : exit()
          }
        />
      ) : (
        <Price s={s} walkthrough={w} update={update} top={top} exit={exit} />
      )}
    </div>
  );
}

function TypePicker({
  address,
  choose,
  exit,
}: {
  address: string;
  choose: (type: PropertyType) => void;
  exit: () => void;
}) {
  return (
    <div className="onsite-body">
      <header className="onsite-head">
        <span>{address}</span>
        <button className="text-button" onClick={exit}>
          Close
        </button>
      </header>
      <h1 tabIndex={-1}>What kind of property is this?</h1>
      <p className="onsite-hint">
        Asked once. It decides which rooms you can tap.
      </p>
      <div className="onsite-types">
        {PROPERTY_TYPES.map((t) => (
          <button key={t} className="secondary" onClick={() => choose(t)}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Capture({
  s,
  walkthrough: w,
  update,
  top,
  finish,
}: {
  s: State;
  walkthrough: Walkthrough;
  update: Update;
  top: () => void;
  finish: (saved: boolean) => void;
}) {
  const property = s.properties.find((p) => p.id === w.propertyId);
  const captured = findingsFor(s, w.id);
  const rooms = roomsFor(s, w.propertyId);
  const earlier = carryCandidates(s, w.id);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  /* Consecutive findings are usually in the same room, so the last one used
     stays selected. A room that is not in the list is "Other" with its text. */
  const last = captured[captured.length - 1]?.area || "";
  const [room, setRoom] = useState(last);
  const [other, setOther] = useState(!!last && !rooms.includes(last));
  const [rejected, setRejected] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [saved, setSaved] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);

  const shoot = async (file?: File) => {
    if (!file) return;
    const stored = await storablePhoto(file);
    setRejected(!stored);
    if (stored) {
      setPhotos((p) => [...p, stored]);
      setEmpty(false);
      setSaved("");
    }
  };

  const hasContent = photos.length > 0 || note.trim().length > 0;
  /** Writes the item in hand, if there is one. */
  const save = () => {
    if (!hasContent) return false;
    update((d) => {
      addFinding(d, w.id, {
        area: room.trim(),
        observed: note.trim(),
        photos,
      });
    });
    setPhotos([]);
    setNote("");
    return true;
  };
  const next = () => {
    if (!hasContent) return setEmpty(true);
    save();
    /* A room typed under Other is now part of this property's history, so the
       next item offers it as a button of its own — selected. */
    if (other && room.trim()) {
      setRoom(room.trim());
      setOther(false);
    }
    setSaved(`Saved · ${captured.length + 1} captured`);
    top();
  };

  return (
    <div className="onsite-body">
      <header className="onsite-head">
        <span>
          {property?.address} · {captured.length} captured
        </span>
        <button className="text-button" onClick={() => finish(save())}>
          Finish
        </button>
      </header>
      <h1 tabIndex={-1} className="sr-only">
        On site
      </h1>

      {!!earlier.length && (
        <div className="onsite-earlier">
          <button
            className="text-button"
            aria-expanded={showEarlier}
            onClick={() => setShowEarlier(!showEarlier)}
          >
            {earlier.length} to re-check from earlier visits
            {showEarlier ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showEarlier && (
            <ul>
              {earlier.map((f) => (
                <li key={f.id}>
                  <strong>{f.title || "Untitled finding"}</strong>
                  <small>
                    {f.area ? f.area + " · " : ""}
                    {findingState(s, f)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {saved && (
        <p className="onsite-saved" role="status">
          {saved}
        </p>
      )}

      <label
        className={"primary onsite-shoot" + (rejected ? " field-error" : "")}
      >
        <Camera size={24} />
        {photos.length ? "Add another photo" : "Take photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          aria-invalid={rejected || undefined}
          onChange={async (e) => {
            await shoot(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {rejected && (
        <span className="field-message" role="alert">
          {unreadableMessage}
        </span>
      )}
      {!!photos.length && (
        <div className="photos">
          {photos.map((src, i) => (
            <span key={i} className="onsite-thumb">
              <img src={src} alt={`Photo ${i + 1} of this item`} />
              <button
                className="text-button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            </span>
          ))}
        </div>
      )}

      <label className={"field" + (empty ? " field-error" : "")}>
        Notes
        <textarea
          value={note}
          rows={3}
          placeholder="What did you see? Tap the mic on your keyboard to talk."
          aria-invalid={empty || undefined}
          onChange={(e) => {
            setNote(e.target.value);
            setEmpty(false);
            setSaved("");
          }}
        />
        {empty && (
          <span className="field-message" role="alert">
            Take a photo or add a note first.
          </span>
        )}
      </label>

      <fieldset className="onsite-rooms">
        <legend>Where</legend>
        <div>
          {rooms.map((r) => (
            <button
              key={r}
              aria-pressed={!other && room === r}
              onClick={() => {
                setRoom(r);
                setOther(false);
              }}
            >
              {r}
            </button>
          ))}
          <button
            aria-pressed={other}
            onClick={() => {
              setOther(true);
              if (rooms.includes(room)) setRoom("");
            }}
          >
            Other
          </button>
        </div>
        {other && (
          <input
            value={room}
            aria-label="Where, in your words"
            placeholder="e.g. Upstairs hallway"
            onChange={(e) => setRoom(e.target.value)}
          />
        )}
      </fieldset>

      <div className="onsite-bar">
        <button className="primary full" onClick={next}>
          Save &amp; next item
        </button>
      </div>
    </div>
  );
}

function Price({
  s,
  walkthrough: w,
  update,
  top,
  exit,
}: {
  s: State;
  walkthrough: Walkthrough;
  update: Update;
  top: () => void;
  exit: () => void;
}) {
  /* Frozen when the step opens. needsPricing() shrinks as items are priced,
     and an index into a list that moves under it would skip the next one. */
  const [queue, setQueue] = useState(() =>
    needsPricing(s, w.id).map((f) => f.id),
  );
  const [at, setAt] = useState(0);
  const items = queue
    .map((id) => s.findings.find((f) => f.id === id))
    .filter((f): f is Finding => !!f);
  const f = items[at];

  if (!f)
    return (
      <SendStep
        s={s}
        walkthrough={w}
        update={update}
        exit={exit}
        back={items.length ? () => setAt(items.length - 1) : undefined}
        again={() => {
          setQueue(needsPricing(s, w.id).map((x) => x.id));
          setAt(0);
        }}
      />
    );
  return (
    <PriceItem
      key={f.id}
      finding={f}
      at={at}
      of={items.length}
      update={update}
      exit={exit}
      back={() => (at ? setAt(at - 1) : exit())}
      next={() => {
        setAt(at + 1);
        top();
      }}
      remove={() => {
        update((d) => {
          d.findings = d.findings.filter((x) => x.id !== f.id);
        });
        setQueue(queue.filter((id) => id !== f.id));
      }}
    />
  );
}

function PriceItem({
  finding: f,
  at,
  of,
  update,
  exit,
  back,
  next,
  remove,
}: {
  finding: Finding;
  at: number;
  of: number;
  update: Update;
  exit: () => void;
  back: () => void;
  next: () => void;
  remove: () => void;
}) {
  const { fail, clear, fieldClass, invalid, Message } = useFieldErrors();
  /* The suggestion is shown in the box as a real value, and written when the
     operator moves on, so what they saw is what was saved. */
  const [title, setTitle] = useState(f.title || suggestTitle(f.observed));
  const patch = (values: Partial<Finding>) =>
    update((d) => {
      const x = d.findings.find((x) => x.id === f.id);
      if (x) Object.assign(x, values);
    });

  const go = () => {
    /* The same two rules sendBlockers() applies, asked of this item only. */
    let ok = true;
    if (!named({ ...f, title })) ok = fail("title", "Give it a name.");
    if (f.pricing === "Quoted" && !quotable(f))
      ok = fail("price", "Price it, or mark it as needing a closer look.");
    if (!ok) return;
    if (title !== f.title) patch({ title: title.trim() });
    next();
  };

  return (
    <div className="onsite-body">
      <header className="onsite-head">
        <span>
          Price items · {at + 1} of {of}
        </span>
        <button className="text-button" onClick={exit}>
          Close
        </button>
      </header>
      <h1 tabIndex={-1} className="sr-only">
        Price item {at + 1} of {of}
      </h1>

      {!!f.photos.length && (
        <div className="photos">
          {f.photos.map((src, i) => (
            <img key={i} src={src} alt={`Item ${at + 1}, photo ${i + 1}`} />
          ))}
        </div>
      )}
      <p className="onsite-room">{f.area || "Room not recorded"}</p>
      <label className="field">
        Notes from site
        <textarea
          value={f.observed}
          rows={2}
          onChange={(e) => patch({ observed: e.target.value })}
        />
      </label>

      <label className={fieldClass("title")}>
        Title the customer sees
        <input
          value={title}
          {...invalid("title")}
          placeholder="e.g. Cabinet hinge loose"
          onChange={(e) => {
            setTitle(e.target.value);
            clear("title");
          }}
        />
        <Message field="title" />
      </label>

      <div className="segmented onsite-pricing">
        <button
          className={f.pricing === "Quoted" ? "chosen" : ""}
          onClick={() => patch({ pricing: "Quoted" })}
        >
          Price it
        </button>
        <button
          className={f.pricing === "Quoted" ? "" : "chosen"}
          onClick={() => {
            patch({ pricing: "Further Assessment Required", price: undefined });
            clear("price");
          }}
        >
          Needs a closer look
        </button>
      </div>
      {f.pricing === "Quoted" ? (
        <label className={fieldClass("price")}>
          Price (CAD)
          {/* The price is the one thing this screen exists to get, so the
              number pad is already up when it opens. */}
          <input
            type="number"
            inputMode="decimal"
            min="1"
            autoFocus
            value={f.price ?? ""}
            {...invalid("price")}
            onChange={(e) => {
              patch({
                price: e.target.value ? Number(e.target.value) : undefined,
              });
              clear("price");
            }}
          />
          <Message field="price" />
        </label>
      ) : (
        <p className="note">
          The customer sees this as pending assessment, with no price.
        </p>
      )}

      <label className="field">
        Proposed work <small>(optional)</small>
        <textarea
          value={f.proposed}
          rows={2}
          onChange={(e) => patch({ proposed: e.target.value })}
        />
      </label>
      <button className="text-button" onClick={remove}>
        Remove item
      </button>

      <div className="onsite-bar row">
        <button className="secondary" onClick={back}>
          Back
        </button>
        <button className="primary grow" onClick={go}>
          Next
        </button>
      </div>
    </div>
  );
}

function SendStep({
  s,
  walkthrough: w,
  update,
  exit,
  back,
  again,
}: {
  s: State;
  walkthrough: Walkthrough;
  update: Update;
  exit: () => void;
  back?: () => void;
  again: () => void;
}) {
  const findings = findingsFor(s, w.id);
  const blocked = sendBlockers(s, w.id).length;
  const total = findings.reduce(
    (n, f) => n + (f.pricing === "Quoted" ? f.price || 0 : 0),
    0,
  );
  return (
    <div className="onsite-body">
      <header className="onsite-head">
        <span>Ready to send</span>
        <button className="text-button" onClick={exit}>
          Close
        </button>
      </header>
      <h1 tabIndex={-1}>
        {findings.length} item{findings.length === 1 ? "" : "s"} ·{" "}
        {money2(total)}
      </h1>
      <p className="onsite-hint">Before tax. The customer approves each one.</p>
      {!findings.length ? (
        <p className="note">Nothing captured yet.</p>
      ) : blocked ? (
        <>
          <p className="field-message" role="alert">
            {blocked} thing{blocked === 1 ? "" : "s"} still need a title or a
            price.
          </p>
          <button className="primary full" onClick={again}>
            Price the rest
          </button>
        </>
      ) : (
        <button
          className="primary full"
          onClick={() => {
            update((d) => {
              sendWalkthrough(d, w.id);
            }, "Assessment sent to the customer");
            exit();
          }}
        >
          Send to customer
        </button>
      )}
      <div className="onsite-bar row">
        {back && (
          <button className="secondary" onClick={back}>
            Back
          </button>
        )}
        <button className="text-button grow" onClick={exit}>
          Back to the walkthrough
        </button>
      </div>
    </div>
  );
}
