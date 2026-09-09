# iShopp Backend Roadmap

## Phase 1 — Core OS

- Next.js application foundation
- Supabase Auth boundary
- PostgreSQL domain model
- RLS and ownership controls
- health and API contracts

## Phase 2 — Savings intelligence

- retailer and branch administration
- product normalization
- specials ingestion
- catalogue/OCR ingestion pipeline
- verification workflow
- price comparison and history

## Phase 3 — Shopper journey

- shopping lists
- saved specials
- social sharing
- basket calculation
- checkout preparation

## Phase 4 — Commerce

- PayFast server-side payment validation
- orders
- fulfilment states
- payment reconciliation

## Non-negotiables

1. Database state is authoritative.
2. Client input is untrusted.
3. AI output is untrusted until validated and verified.
4. Financial state is never derived from AI output.
5. Every capability ships with migration, authorization, API contract and automated verification.
6. Frontend polish follows backend correctness.
