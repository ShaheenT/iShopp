# Specials API

The specials API treats the database as the source of truth and exposes only verified, currently active specials to public shoppers.

## Public discovery

`GET /api/specials`

Optional query parameters:

- `retailerId` — UUID
- `productId` — UUID
- `categoryId` — UUID
- `limit` — 1–100, default 24
- `offset` — 0–10000, default 0

Public reads are still constrained by Supabase RLS. A special must be `verified`, have started, and not have expired.

## Ingestion

`POST /api/specials/ingest`

The endpoint accepts a normalized special and always writes it as `pending`. A caller cannot submit `verified` state or `verified_at`.

Authorization supports either:

1. `x-ishopp-ingestion-token` matching the server-only `ISHOPP_INGESTION_API_TOKEN`, for trusted ingestion workers; or
2. an authenticated Supabase user whose `app_metadata.role` is `admin`.

The service-role client is used only on the server for the controlled ingestion write. It must never be exposed to browser code.

## Verification boundary

Ingestion and verification are deliberately separate. OCR, catalogue parsing, retailer feeds, or future AI extraction may create pending records, but only a trusted verification workflow should promote a record to `verified`.

This preserves the core iShopp rule: AI can assist with extraction and classification, but it does not authorize financial or trust state.
