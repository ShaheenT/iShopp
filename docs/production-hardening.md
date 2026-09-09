# Production hardening gates

## Commercial truth

Canonical prices, delivery fees, minimum-order values and availability come only from verified server-side records. Community observations are intelligence until verified and must not overwrite canonical specials.

## Contribution integrity

Community submissions require evidence, are pending until authorized verification, cannot be self-verified, and are rate-limited and duplicate-protected. Rewards are issued only after verification through an idempotent ledger entry.

## Trust

Trust is derived from verified and rejected outcomes. The client cannot write trust profiles or reward records.

## Action integrity

Shopping plans are snapshots of currently verified specials and fulfilment rules. The database rechecks item prices, currencies, delivery fees, minimum orders and landed totals during plan creation. A client cannot submit arbitrary commercial values and receive a valid plan.

Plans expire after 24 hours. They are not checkout authorizations; a future checkout integration must revalidate the underlying commercial facts before payment/order submission.

## CI release gate

A release candidate is not considered green until GitHub Actions executes typecheck, Playwright, and Supabase migration-reset validation successfully. A workflow with no executed steps is treated as infrastructure failure, not application success.
