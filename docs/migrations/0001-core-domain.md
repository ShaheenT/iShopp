# Migration 0001–0003 review notes

These migrations establish the first production database boundary for iShopp.

## Included

- authenticated shopper profiles
- retailers and physical branches
- product normalization
- time-bound specials with source and verification metadata
- shopper-owned shopping lists and list items
- Row Level Security on every application table
- automatic profile creation from Supabase Auth
- consistent `updated_at` handling

## Security posture

Anonymous and authenticated clients can discover only verified public catalogue data. Shopper-owned records are restricted by `auth.uid()`. Retailer administration is intentionally not exposed as a client-side write capability at this stage.

## Product boundary

This schema supports the core promise of iShopp: discover useful savings, determine whether the saving is trustworthy, and save it for a real shopping journey. Social distribution, ingestion/OCR, basket, payment and fulfilment remain separate bounded domains.
