# iShopp Architecture Decision Log

## ADR-001 — Production rebuild

The legacy `iShoppTest` application remains a reference archive. Production development happens in `iShopp`.

## ADR-002 — Backend first

The data model, authorization, APIs and transaction boundaries are established before frontend feature expansion.

## ADR-003 — Supabase/PostgreSQL as source of truth

Application state, catalogue state, shopping state, payment state and fulfilment state are authoritative in PostgreSQL.

## ADR-004 — AI is advisory

AI can extract information from catalogues, normalize products and rank useful savings. AI cannot authorize transactions or become the source of financial truth.

## ADR-005 — Verification before discovery

A special can be ingested without being trusted. Public discovery requires explicit verification and an active validity window.
