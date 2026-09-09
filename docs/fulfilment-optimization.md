# Fulfilment-aware basket optimization

The fulfilment layer extends basket optimization from shelf price to practical landed cost.

For each selected fulfilment scope, iShopp can account for:

- verified product subtotal
- verified delivery fee
- verified minimum-order requirement
- explicit user store-visit cost

The optimizer evaluates retailer combinations up to `maxStores`, chooses the lowest valid landed cost, and uses deterministic tie-breaking.

`POST /api/basket/{basketId}/fulfilment-optimize` accepts only optimization preferences: `maxStores` and `storeVisitCost`. Retailer delivery fees, minimum-order values, effective dates, and fulfilment availability are loaded from verified server-side fulfilment rules. The response marks the commercial fulfilment pricing as `fulfilmentPricingMode: verified` and identifies `supabase_verified_effective_rules` as the source.

A minimum-order requirement is a hard commercial constraint. An allocation that does not reach the verified minimum is rejected rather than converted into a synthetic surcharge. Delivery fees are charged once per fulfilment scope, while the user's store-visit cost is applied once per retailer.

Branch-specific verified rules take precedence over retailer-wide rules. Only currently effective, available, verified delivery rules with usable evidence are exposed by the fulfilment RPC.

## Ingestion and verification

Fulfilment terms enter the system through `POST /api/fulfilment/ingest`. The endpoint validates the commercial payload and submits a pending rule together with source evidence. Only users explicitly provisioned as active fulfilment ingestors can perform this operation.

Verification is a separate state transition through `POST /api/fulfilment/{ruleId}/verify`. The database requires usable evidence before a rule can become verified and records the verification event and actor. Normal authenticated users cannot write directly to fulfilment tables.

This creates the trusted production flow:

`retailer / branch → ingestion → evidence → verification → effective period → optimizer`

AI and frontend clients must not override verified prices, delivery fees, minimum-order values, availability, or effective dates.
