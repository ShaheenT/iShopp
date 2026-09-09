# iShopp Core Domain Model

## Product model

`retailers` own the merchant identity. `store_branches` represent physical locations. `products` represent normalized sellable items. `specials` represent time-bound pricing at retailer or branch level.

The canonical savings record is the `specials` row. A deal is not trusted merely because it was discovered by AI or submitted by a user; it becomes publicly discoverable only after verification.

## Shopper model

Supabase Auth owns identity. `profiles` stores application-level profile data. `shopping_lists` belong to authenticated shoppers and `shopping_list_items` reference a product and/or a specific special.

## Trust model

Public discovery is intentionally read-only and limited to verified, active records. Write operations for shopper-owned data are protected by ownership RLS. Retailer and catalogue administration will use controlled server-side workflows rather than exposing broad client write permissions.

## Future domains

The schema is designed to extend into:

- special ingestion and OCR/document processing
- price history and comparison intelligence
- social sharing, likes and comments
- baskets and checkout
- PayFast payment records
- order and fulfilment state
- retailer verification and merchant tooling

Those domains will be introduced through separate migrations and API contracts rather than coupling the initial schema to speculative features.
