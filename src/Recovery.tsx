import {
  Component,
  Suspense,
  lazy,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { KEY } from "./store";

/**
 * What the prototype does when its saved state cannot be rendered.
 *
 * Every screen resolves the active request, its tasks and its visit up front
 * and uses them without guards, so a saved state whose records do not line up
 * — a visit pointing at a request that is no longer there, a collection that a
 * migration never backfilled — throws during render. React unmounts the tree
 * on an uncaught render error, and because the state that caused it is sitting
 * in localStorage, every reload does it again: a blank page, no message, and
 * no way back that does not involve developer tools.
 *
 * So there is a boundary, and it lands somewhere that explains the situation
 * and offers the one thing that fixes it. Resetting is destructive, so it is
 * the user's decision and not something that happens behind their back — the
 * broken state stays on disk until they say otherwise, which also means it is
 * still there to be inspected.
 */
export function RecoveryScreen({
  detail,
  onReset,
}: {
  detail?: string;
  onReset?: () => void;
}) {
  const reset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    if (onReset) onReset();
    else location.reload();
  };
  return (
    <div className="recovery">
      <div className="recovery-card card">
        <span className="eyebrow">FIELDWORK PROTOTYPE</span>
        <h1>This demo&rsquo;s saved data can&rsquo;t be opened.</h1>
        <p>
          The copy of the demo stored in this browser is in a state the app
          can&rsquo;t render. Nothing here was sent anywhere, and nothing on
          your device outside this prototype is affected.
        </p>
        <p>
          Resetting clears that stored copy and starts again from the sample
          data. Any requests, walkthroughs or photos you added in this browser
          will go with it.
        </p>
        <div className="row actions">
          <button className="primary" onClick={reset}>
            Reset the demo
          </button>
          <a className="secondary" href="?view=blueprint">
            Developer blueprint ↗
          </a>
        </div>
        {detail && (
          <details className="recovery-detail">
            <summary>Technical detail</summary>
            <pre>{detail}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * The backstop. A shape check on the way in cannot catch a state whose records
 * simply disagree with each other, and those are exactly the ones that throw
 * three components deep, so the boundary is what turns any of them into a
 * screen instead of a blank page.
 */
export class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("fieldwork: unrecoverable render error", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <RecoveryScreen detail={this.state.error.message} />;
  }
}

/**
 * Screens most visits never open load on demand (ADR 074). A deploy replaces
 * every hashed file, so a tab left open across one asks for a chunk that is no
 * longer there. That is not the saved data's fault, and the boundary above
 * would offer to reset it, so the failure is tagged where the import happens
 * and caught here, where the fix is a reload.
 */
class ChunkError extends Error {}

export function lazyScreen<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
) {
  /* React suspends a lazy component on its first render even when its chunk
     is already here, which shows "Loading…" for a frame. Once `preload()` or
     a render has it, a screen mounted later renders it directly. Each mount
     picks one way and keeps it, so a mounted screen never swaps its tree. */
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<{ default: ComponentType<P> }> | undefined;
  const loadOnce = () =>
    (pending ??= load().then(
      (m) => {
        loaded = m.default;
        return m;
      },
      (e: unknown) => {
        pending = undefined;
        throw e;
      },
    ));
  const Screen = lazy(() =>
    loadOnce().catch((e: unknown) => {
      throw new ChunkError(e instanceof Error ? e.message : String(e));
    }),
  );
  function LazyScreen(props: P) {
    const [Ready] = useState(() => loaded);
    if (Ready) return <Ready {...props} />;
    return (
      <ChunkBoundary>
        <Suspense
          fallback={
            <p className="muted lazy-loading" role="status">
              Loading&hellip;
            </p>
          }
        >
          <Screen {...props} />
        </Suspense>
      </ChunkBoundary>
    );
  }
  /* Fetches the chunk ahead of time. A failure is left for the screen to
     report, with a reload, if it is opened. */
  LazyScreen.preload = () => {
    loadOnce().catch(() => {});
  };
  return LazyScreen;
}

class ChunkBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    /* Anything else is the saved data's problem: hand it to the outer one. */
    if (!(error instanceof ChunkError)) throw error;
    return (
      <div className="recovery">
        <div className="recovery-card card" role="alert">
          <span className="eyebrow">FIELDWORK PROTOTYPE</span>
          <h1>This page didn&rsquo;t load.</h1>
          <p>
            The demo may have been updated since this tab was opened. Reloading
            fetches the latest version; your saved demo data stays as it is.
          </p>
          <div className="row actions">
            <button className="primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
