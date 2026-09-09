# Savings Optimization

The savings optimizer turns verified basket offers into a practical purchasing plan.

It minimizes **landed basket cost**, not just shelf price:

`landed cost = product cost + (retailer count × store visit cost)`

The store visit cost is an explicit caller assumption. It can represent travel, parking, time, delivery, or another user-defined friction. iShopp does not silently estimate it.

The optimizer evaluates retailer combinations up to `maxStores` (1–5), selects the cheapest verified offer for every basket item within each combination, and deterministically breaks ties by fewer retailers and retailer IDs.

API:

`GET /api/basket/{basketId}/optimize?maxStores=2&storeVisitCost=10`

Security:

- Authentication is required.
- Basket ownership is enforced through the authenticated user.
- Offer data comes from the server-side verified-offer RPC.
- Only verified products, verified active specials, active/verified retailers, and active branches are eligible.
- Prices are never supplied by the client.

This layer is deliberately deterministic. Future distance, delivery, loyalty, minimum-order, and fulfilment models can be added as explicit cost inputs without changing the financial source of truth.
