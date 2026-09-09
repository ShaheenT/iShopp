# Verified fulfilment

Fulfilment is a trusted input to iShopp's basket optimizer, not a caller-supplied price assumption.

The production flow is:

`retailer / branch → fulfilment rule → evidence → verification → effective period → optimizer`

`fulfilment_rules` stores the commercial rule. A rule can be retailer-wide (`store_branch_id = NULL`) or branch-specific. Branch-specific rules take precedence over retailer-wide rules for the same delivery offer.

A rule contains:

- fulfilment mode (`delivery`, `pickup`, or `collection`)
- availability
- delivery fee
- minimum order value
- currency
- effective start/end timestamps
- source URL/type/hash
- verification status, verifier, timestamp, and reason

`fulfilment_evidence` stores the evidence supporting a rule, including source metadata, capture time, extracted text/data, and optional storage path. `fulfilment_verification_events` provides the audit trail for verification decisions.

Verified delivery rules are constrained so overlapping active verified rules cannot exist for the same retailer, branch scope, and fulfilment mode. The database also enforces that a branch belongs to the retailer named by the rule.

The basket fulfilment RPC only returns currently effective, available, verified delivery rules. Expired, future, unverified, unavailable, or unsupported rules do not enter production optimization.

## Optimizer contract

`POST /api/basket/{basketId}/fulfilment-optimize` accepts only basket optimization preferences:

```json
{
  "maxStores": 2,
  "storeVisitCost": 0
}
```

The endpoint no longer accepts delivery fees or minimum-order values from the caller. Those values are read server-side from verified effective fulfilment rules.

A minimum-order value is a hard commercial constraint. If the selected fulfilment scope is below its verified minimum, that allocation is rejected rather than represented as a fabricated surcharge or assumed top-up.

Delivery fees are applied once per selected fulfilment scope. Product prices remain sourced from the existing verified-special pipeline.

## Trust boundary

The optimizer therefore consumes:

`verified product + verified active special + verified active retailer/branch + verified effective fulfilment rule + basket + user preferences`

AI or frontend code must not override verified prices, delivery fees, or minimum-order requirements. Any future scenario simulation should be a separate explicit mode and must never masquerade as verified commercial truth.
