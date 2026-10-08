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
import type { Property, Quote, Request, State, Task, Visit } from "./model";
import type { CustomerGlance } from "./glance";
import type { CustomerTodo } from "./roleQueues";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

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
