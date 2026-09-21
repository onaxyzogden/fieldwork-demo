import { type State, type Property, uid } from "./model";

/** Ontario HST. Snapshotted onto a walkthrough when it is sent, never read live. */
export const HST = 0.13;

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
/**
 * Two requests belong to the same property when the same customer gave the same
 * address. Used only to rebuild links for states saved before properties
 * existed — once a request carries a propertyId, the key is never consulted
 * again, so editing an address later cannot silently re-home a request.
 */
export const propertyKey = (p: {
  address: string;
  city: string;
  customerId: string;
}) => [norm(p.address), norm(p.city), p.customerId].join("|");

/**
 * Backfills the PMW record arrays and gives every pre-existing request a
 * property. Additive and idempotent, in the shape of migrateDispatch: a request
 * that already has a propertyId is left exactly as it was, which is why seeded
 * state passes through unchanged.
 */
export function migratePmw(s: State) {
  s.properties ??= [];
  s.walkthroughs ??= [];
  s.findings ??= [];
  for (const r of s.requests) {
    if (r.propertyId) continue;
    const key = propertyKey(r);
    let property = s.properties.find((p) => propertyKey(p) === key);
    if (!property) {
      property = {
        id: uid(),
        customerId: r.customerId,
        address: r.address,
        city: r.city,
        ...(r.unit ? { unit: r.unit } : {}),
        ...(r.postalCode ? { postalCode: r.postalCode } : {}),
      } satisfies Property;
      s.properties.push(property);
    }
    r.propertyId = property.id;
  }
  return s;
}
