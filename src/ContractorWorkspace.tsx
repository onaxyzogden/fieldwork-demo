import ContractorWork from "./ContractorWork";
import Availability from "./Availability";
import Earnings from "./EarningsPanel";
import { providers } from "./model";
import { useWorkspace } from "./workspaceContext";

export function ContractorWorkspace() {
  const {
    contractor,
    contractorVisit,
    openContractorJob,
    page,
    s,
    setContractor,
    setPage,
    update,
  } = useWorkspace();
  return (
    <>
      {/* Same pill idiom as the customer switcher. Yousef is included:
          he takes jobs as well as dispatching them, so he is a real
          contractor identity, not just the operator. */}
      <div className="identity-switch" role="group" aria-label="Viewing as">
        <span className="eyebrow">VIEWING AS</span>
        {providers.map((p) => (
          <button
            key={p.id}
            className="badge"
            aria-pressed={contractor === p.id}
            onClick={() => setContractor(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
      {page === "Earnings" ? (
        <Earnings key={contractor} s={s} provider={contractor} />
      ) : page === "Availability" ? (
        <Availability
          key={contractor}
          s={s}
          update={update}
          provider={contractor}
          openJob={openContractorJob}
        />
      ) : (
        <ContractorWork
          key={contractor}
          s={s}
          provider={contractor}
          openVisit={contractorVisit}
          update={update}
          openAvailability={() => setPage("Availability")}
        />
      )}
    </>
  );
}
