/**
 * What `Workspace` shares with the role workspaces it renders (ADR 077).
 *
 * `Workspace` still owns all the state and helpers. As each role or page
 * moves into its own component, the names that component reads are added
 * here, so this type grows into the workspace's real shared API one
 * extraction at a time. Types are the ones `Workspace` declares them with.
 */
import { createContext, useContext } from "react";
import type React from "react";
import type {
  AuditEntry,
  Property,
  Quote,
  Request,
  State,
  Task,
  Visit,
  scopeMatch,
} from "./model";
import type { CustomerGlance } from "./glance";
import type { CustomerTodo } from "./roleQueues";
import type { Role } from "./Shell";
import type { suitableProviders } from "./suitability";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Candidate = ReturnType<typeof suitableProviders>[number];

export type WorkspaceApi = {
  /* Shared */
  s: State;
  update: (fn: (d: State) => void, msg?: string) => void;
  notify: (text: string) => void;
  page: string;
  setPage: Setter<string>;
  setModal: Setter<string>;
  idPrefix: string;

  /* Operator */
  choose: (id: string) => void;
  setSidebar: Setter<boolean>;
  RouteMap: () => React.JSX.Element;

  /* Operator: Requests */
  Message: ({ field }: { field: string }) => React.JSX.Element | null;
  assignPay: number;
  badge: (status: string) => React.JSX.Element;
  cancelVisit: (v: Visit) => void;
  candidates: Candidate[];
  chosenTime: string | undefined;
  clear: (field: string) => void;
  createVisit: () => boolean | undefined;
  decisionCard: () => React.JSX.Element;
  duration: number;
  fieldClass: (field: string, base?: string) => string;
  filter: string;
  fulfillment: boolean;
  fulfillmentKind: "self" | "contractor";
  invalid: (field: string) => { "aria-invalid": true | undefined };
  invalidate: (field: string, message: string) => boolean;
  liveVisits: Visit[];
  match: ReturnType<typeof scopeMatch>;
  opts: Candidate["appointments"];
  patchTask: (id: string, p: Partial<Task>) => void;
  provider: string;
  requestStatus: (id: string) => string;
  scopeTasks: Task[];
  search: string;
  selected: string[];
  setFilter: Setter<string>;
  setFulfillment: Setter<boolean>;
  setOverride: Setter<string>;
  setPay: Setter<number>;
  setPayTouched: Setter<boolean>;
  setProvider: Setter<string>;
  setRequestTab: Setter<string>;
  setRole: Setter<Role>;
  setSearch: Setter<string>;
  setSelected: Setter<string[]>;
  setShowRequestQueue: Setter<boolean>;
  setTaskTitles: Setter<Record<string, string>>;
  showRequestQueue: boolean;
  showTasks: () => void;
  slot: string;
  tab: string;
  taskTitles: Record<string, string>;
  trail: AuditEntry[];

  /* Customer */
  customer: string;
  setCustomer: Setter<string>;
  customerAtAGlance: CustomerGlance;
  customerBadge: (status: string) => React.JSX.Element;
  customerNext: { visit: Visit; address: string; requestId: string } | null;
  customerProperties: Property[];
  customerToday: Visit[];
  customerTodoList: CustomerTodo[];
  customerTodos: number;
  ownRequests: Request[];
  openRequestRow: (id: string) => void;
  openFirst: (ids: string[]) => (() => void) | undefined;
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
  chargePanel: () => React.JSX.Element | null;
  quotePanel: () => React.JSX.Element | null;
  taskPhotos: (t: Task) => React.JSX.Element;
  visitCard: (v: Visit) => React.JSX.Element;

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
