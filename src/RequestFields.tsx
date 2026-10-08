import {
  getIssue,
  matchIssues,
  answerKey,
  inferredAnswers,
  questionAnswers,
  needsClarificationReview,
  reportedConcern,
} from "./clarification";
import { useState, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { type Task, available, confirmed } from "./model";

/**
 * Submit-type actions stay enabled and validate on click.
 *
 * A disabled button drops out of tab order, stays silent to screen readers, and
 * fires no pointer events — so any tooltip explaining why it is blocked never
 * reaches the person who needed it, and the greyed label usually fails contrast
 * besides. Instead: always clickable, and on failure mark the blocking field,
 * say why beside it, and move focus there.
 */
export function NoteReply({ onSend }: { onSend: (reply: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <label className={"field" + (error ? " field-error" : "")}>
        Your reply
        <textarea
          ref={ref}
          value={text}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "note-reply-error" : undefined}
          placeholder="Add the requested details…"
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
        />
        {error && (
          <span className="field-message" id="note-reply-error" role="alert">
            <AlertCircle size={16} /> {error}
          </span>
        )}
      </label>
      <button
        className="secondary"
        onClick={() => {
          if (!text.trim()) {
            setError("Add your reply before sending.");
            ref.current?.focus();
            return;
          }
          onSend(text.trim());
          setText("");
        }}
      >
        Send reply
      </button>
    </>
  );
}
export function TaskAnswers({ task }: { task: Task }) {
  const rows = questionAnswers(task);
  const policy = getIssue(task.description);
  return (
    <>
      {policy.availability === "Referral only" && (
        <p className="warning">
          Referral only: this service is not bookable through the demo. The
          operator can review the request and advise on the next step.
        </p>
      )}
      {reportedConcern(task) && (
        <p className="warning">
          Reported condition needs operator attention. Review the customer’s
          answers before scheduling.
        </p>
      )}
      {rows.length > 0 && (
        <dl className="task-answers">
          {rows.map((row) => (
            <div key={row.key}>
              <dt>
                {row.label}
                {row.inferred ? " · From your description" : ""}
              </dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
export function ClarificationFields({
  task,
  onChange,
  attempted,
}: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  attempted?: boolean;
}) {
  const issue = getIssue(task.description);
  const inferred = inferredAnswers(task.description);
  const setAnswer = (key: string, value: string) => {
    const answers = { ...task.answers, [key]: value };
    onChange({
      issueId: issue.id,
      answers,
      ...(issue.id === "tv" && answers["tv:cables"] === "New electrical outlet"
        ? { restricted: true }
        : {}),
      ...(needsClarificationReview({ ...task, answers })
        ? { reviewed: false }
        : {}),
    });
  };
  const multiple = matchIssues(task.description).filter(
    (i) =>
      i.id !== issue.id &&
      !(
        ["outlet", "wiring"].includes(i.id) &&
        ["outlet", "wiring", "tv"].includes(issue.id)
      ),
  );
  return (
    <>
      {issue.availability === "Referral only" && (
        <p className="warning">
          We can record this for referral review, but this service is not
          available for booking through the platform.
        </p>
      )}
      {issue.availability !== "Referral only" &&
        (task.restricted || issue.review) && (
          <p className="warning">
            Yousef will review the scope and arrange the right provider before
            an appointment is confirmed.
          </p>
        )}
      {multiple.length > 0 && (
        <p className="note">
          This may describe more than one problem: {issue.title} and{" "}
          {multiple.map((i) => i.title).join(", ")}. If these are separate jobs,
          use Back and add each as its own task.
        </p>
      )}
      {issue.questions.map((q) => {
        const key = answerKey(issue, q);
        const answered = !!(task.answers[key] ?? inferred[key])?.trim();
        const showError = !!attempted && !answered;
        const field = (
          <label
            className={"field" + (showError ? " field-error" : "")}
            key={key}
          >
            {q.label}
            {key in inferred && !(key in task.answers) && (
              <small>From your description — please check this answer.</small>
            )}
            {q.options ? (
              <select
                id={"q-" + task.id + "-" + key}
                value={task.answers[key] ?? inferred[key] ?? ""}
                aria-invalid={showError || undefined}
                onChange={(e) => setAnswer(key, e.target.value)}
              >
                <option value="">Choose an answer…</option>
                {q.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              /* A standalone "Not sure" beside the field, not just placeholder
                 text suggesting it — the escape hatch stays one tap away
                 whether or not the question was ever attempted. */
              <div className="field-with-action">
                <input
                  id={"q-" + task.id + "-" + key}
                  value={task.answers[key] || ""}
                  placeholder="Add details, or enter Not sure"
                  aria-invalid={showError || undefined}
                  onChange={(e) => setAnswer(key, e.target.value)}
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAnswer(key, "Not sure")}
                >
                  Not sure
                </button>
              </div>
            )}
            {showError && (
              <span className="field-message" role="alert">
                Answer this, or tap Not sure.
              </span>
            )}
          </label>
        );
        return key in inferred && !(key in task.answers) ? (
          <details className="inferred-answer" key={key}>
            <summary>{inferred[key]} · From your description · Edit</summary>
            {field}
          </details>
        ) : (
          field
        );
      })}
      {["sink-drain", "bath-drain", "toilet-block"].includes(issue.id) &&
        /cleaner|chemical|drano|liquid.plumr/i.test(
          task.answers[issue.id + ":tried"] || "",
        ) && (
          <label className="field">
            Which product was used, and when?
            <input
              value={task.answers[issue.id + ":product"] || ""}
              onChange={(e) => setAnswer(issue.id + ":product", e.target.value)}
            />
          </label>
        )}
      <label className="field">
        Anything else we should know? (optional)
        <textarea
          value={task.answers["intake:details"] || ""}
          onChange={(e) => setAnswer("intake:details", e.target.value)}
        />
      </label>
      {reportedConcern(task) && (
        <p className="warning">
          We’ll flag this condition for operator attention. This prototype does
          not dispatch emergency assistance.
        </p>
      )}
    </>
  );
}
