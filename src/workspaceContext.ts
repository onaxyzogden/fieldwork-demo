/**
 * What `Workspace` shares with the role workspaces it renders (ADR 077).
 *
 * `useWorkspaceState()` owns the state and the helpers more than one place
 * reads. Each role file keeps its own helpers and reads the rest from here,
 * so this type lists exactly the names the role files read. Types are the
 * ones the hook declares them with.
 */
import { createContext, useContext } from "react";
import type React from "react";
import type { Quote, Request, State, Task, Visit } from "./model";
import type { Role } from "./Shell";
import type { suitableProviders } from "./suitability";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Candidate = ReturnType<typeof suitableProviders>[number];

/** A toast that reports a failure is an alert, and stays up longer
 *  (ADR 080). Anything else is a status. */
export type Tone = "error";

export type WorkspaceApi = {
  /* Shared */
  s: State;
  update: (fn: (d: State) => void, msg?: string, tone?: Tone) => void;
  notify: (text: string, tone?: Tone) => void;
  page: string;
  setPage: Setter<string>;
  setModal: Setter<string>;
  idPrefix: string;

  /* Operator */
  choose: (id: string) => void;
  setSidebar: Setter<boolean>;

  /* Operator: Requests */
  Message: ({ field }: { field: string }) => React.JSX.Element | null;
  amount: number;
  badge: (status: string) => React.JSX.Element;
  booked: boolean;
  candidates: Candidate[];
  chosenTime: string | undefined;
  clear: (field: string) => void;
  clearAll: () => void;
  completion: boolean;
  duration: number;
  fieldClass: (field: string, base?: string) => string;
  filter: string;
  fits: boolean;
  fulfillment: boolean;
  fulfillmentKind: "self" | "contractor";
  invalid: (field: string) => { "aria-invalid": true | undefined };
  invalidate: (field: string, message: string) => boolean;
  lateFee: number | null;
  override: string;
  patchTask: (id: string, p: Partial<Task>) => void;
  pay: number;
  payTouched: boolean;
  provider: string;
  quoteTouched: boolean;
  quoteType: string;
  scopeTasks: Task[];
  search: string;
  selected: string[];
  setCompletion: Setter<boolean>;
  setFilter: Setter<string>;
  setFulfillment: Setter<boolean>;
  setFulfillmentKind: Setter<"self" | "contractor">;
  setLateFee: Setter<number | null>;
  setOverride: Setter<string>;
  setPay: Setter<number>;
  setPayTouched: Setter<boolean>;
  setProvider: Setter<string>;
  setQuoteAmount: Setter<number>;
  setQuoteTouched: Setter<boolean>;
  setQuoteType: Setter<string>;
  setRequestTab: Setter<string>;
  setReschedule: Setter<string>;
  setRole: Setter<Role>;
  setSearch: Setter<string>;
  setSelected: Setter<string[]>;
  setShowRequestQueue: Setter<boolean>;
  setTaskTitles: Setter<Record<string, string>>;
  showRequestQueue: boolean;
  slot: string;
  tab: string;
  taskTitles: Record<string, string>;
  toast: string;

  /* Customer */
  customer: string;
  setCustomer: Setter<string>;
  ownRequests: Request[];
  startOrResumeRequest: () => void;
  reveal: (id: string) => number;
  r: Request;
  tasks: Task[];
  visits: Visit[];
  quote: Quote | undefined;
  setActive: Setter<string>;
  expanded: boolean;
  setExpanded: Setter<boolean>;
  reviewing: boolean;
  setReviewing: Setter<boolean>;
  fail: boolean;
  setSlot: Setter<string>;
  setStep: Setter<number>;
  taskPhotos: (t: Task) => React.JSX.Element;
  visitCard: (v: Visit) => React.JSX.Element;
  badgeTone: (status: string) => "green" | "red" | "";
  photo: (t: Task, file?: File) => Promise<boolean | undefined>;
  role: Role;

  /* Contractor */
  contractor: string;
  setContractor: Setter<string>;
  contractorVisit: string;
  openContractorJob: (visitId: string) => void;
};

export const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const api = useContext(WorkspaceContext);
  if (!api) throw new Error("useWorkspace() outside <Workspace>");
  return api;
}
