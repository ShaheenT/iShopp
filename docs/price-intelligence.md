# Price intelligence

The iShopp price-intelligence layer converts verified special history into a deterministic savings signal.

## Source of truth

Only `specials` with `verification_status = 'verified'` are included. The product must also be verified. The database RPC is the authoritative aggregate used by the API.

## Metrics

- `sample_size`: number of verified historical special prices available.
- `lowest_price` / `highest_price`: observed verified special-price bounds.
- `median_price`: median verified special price.
- `current_price`: latest currently active verified special price.
- `current_regular_price`: regular price attached to the current special, when available.
- `savings_percent`: percentage reduction from regular price to current special price.
- `price_vs_median_percent`: current price relative to the verified historical median.
- `price_signal`: `exceptional`, `good`, `typical`, `high`, or `insufficient_data`.

## Signal thresholds

- Exceptional: current price is more than 10% below median.
- Good: current price is 3% to 10% below median.
- Typical: current price is within +/-3% of median.
- High: current price is more than 3% above median.
- Insufficient data: no comparable verified price history or no current verified special.

The thresholds are intentionally deterministic. AI may later explain or enrich the result, but it must not override the underlying price calculation.

## API

`GET /api/specials/intelligence?productId=<uuid>`

The endpoint returns a single `data` object containing the metrics above. Invalid UUIDs return `400`; an unavailable database operation returns `500`.
