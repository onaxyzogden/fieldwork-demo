import { Component, type ReactNode } from "react";
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
