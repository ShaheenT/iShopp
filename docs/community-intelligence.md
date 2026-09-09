# Community intelligence

The community layer is an evidence-backed observation system, not an uncontrolled price feed.

## Trust boundary

A user submits an observed price with evidence. The submission remains `pending` until an explicitly provisioned community verifier reviews the evidence. A verifier cannot verify their own submission. Rejected submissions do not receive rewards.

Verified observations can feed price intelligence, but they do not overwrite canonical retailer specials. Canonical purchasable offers remain the verified special pipeline.

## Anti-gaming controls

The submission RPC rejects duplicate observations from the same user/product/retailer/price within 24 hours and caps contributions at 30 per user per day. These controls are deliberately conservative; stronger reputation and anomaly detection can be added once real contribution data exists.

## Trust

Trust is derived from verified outcomes:

- verified contribution history contributes up to 40 points;
- verification accuracy contributes up to 60 points;
- `new`, `contributor`, `trusted`, and `expert` levels are deterministic projections of that score.

The trust profile is a derived projection and is never directly writable by a client.

## Rewards

The reward ledger is append-only from the application boundary. A verified contribution earns 10 non-cash platform points exactly once. Rejected or pending observations earn nothing.

Points are intentionally not cash. Any future cash redemption, marketplace payout, or financial incentive requires a separate product/legal/payment design.

## Price intelligence

`get_community_price_intelligence` aggregates only verified observations for verified products at active, verified retailers. It exposes sample size, low/high/median and latest observation. Mixed currencies are not combined; the dominant currency is selected for the aggregate.

Community observations remain informational until a verified commercial offer exists. The optimizer must never treat an observation as a purchasable offer merely because it is recent or cheap.

## Action layer

`POST /api/basket/{basketId}/plan` runs the same server-side verified special + fulfilment optimization as the fulfilment endpoint and creates a 24-hour shopping-plan snapshot. The database revalidates each special and fulfilment rule before the snapshot is stored.

This establishes the product loop:

`Snap / Scan → Share → Verify → Understand → Save → Act → Share`

The important invariant is that community contribution increases intelligence, while verified commercial records remain the source of truth for action.
