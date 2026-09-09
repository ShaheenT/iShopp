# Fulfilment-aware basket optimization

The fulfilment layer extends basket optimization from shelf price to practical landed cost.

For each selected retailer, iShopp can account for:

- product subtotal
- delivery fee
- minimum-order requirement
- explicit store-visit cost

The optimizer evaluates retailer combinations up to `maxStores`, chooses the lowest valid landed cost, and uses deterministic tie-breaking.

`POST /api/basket/{basketId}/fulfilment-optimize` accepts a scenario payload containing retailer fulfilment assumptions. The response explicitly marks these values as `fulfilmentPricingMode: scenario` because caller-supplied delivery fees and minimum-order thresholds are not treated as verified commercial facts.

This is deliberately separate from verified special pricing. Verified prices come from the server-side verified-offer pipeline; scenario fulfilment assumptions can influence optimization but cannot alter the underlying price evidence.

## Next production step

Move retailer/branch fulfilment terms into verified database records with effective dates and source evidence. The optimization API should then consume those server-side facts and distinguish verified fulfilment costs from user-provided estimates.
