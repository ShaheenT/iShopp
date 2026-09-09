# Basket Intelligence

Basket Intelligence answers: **What is the cheapest practical way to buy my whole basket?**

The backend treats verified, currently active specials as the only financial source of truth. It does not use AI to calculate prices.

## Strategies

- `split_minimum`: cheapest verified offer for each basket item independently. This establishes the mathematical minimum and may require multiple retailers.
- `single_retailer`: cheapest retailer that can supply every basket item from its verified active offers.
- `practical`: cheapest complete basket using at most `maxStores` retailers. The default is two stores. Total cost is the primary optimization objective; fewer stores is used as a deterministic tie-breaker.
- `unavailable`: returned when one or more basket products have no verified active offer.

Quantities are multiplied by the current verified special price. Retailer subtotals and item-level allocations are returned so the frontend can explain the recommendation rather than presenting an opaque total.

## API

`GET /api/basket/{basketId}/intelligence?maxStores=2`

The endpoint requires an authenticated Supabase session and only returns data for a basket owned by the current user.

Response shape:

```json
{
  "data": {
    "currency": "ZAR",
    "itemCount": 3,
    "requestedQuantity": 4,
    "splitMinimum": {},
    "singleRetailer": {},
    "practical": {},
    "savingsVsSingleRetailer": 13,
    "savingsVsSplitMinimum": 0
  },
  "meta": {
    "basketId": "...",
    "maxStores": 2
  }
}
```

`maxStores` is deliberately explicit. It is a shopper constraint, not an invented estimate of travel cost. Future iterations can add distance, fuel, delivery fees, store hours, stock confidence and user preferences as separate optimization inputs.

## Security

The input RPC verifies basket ownership with `auth.uid()`. It only considers verified products, verified specials inside their active date window, and active + verified retailers. The browser never supplies prices as trusted values.
