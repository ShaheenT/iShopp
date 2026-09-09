# Catalogue ingestion pipeline

The catalogue pipeline keeps machine extraction separate from the canonical verified `specials` table.

## Flow

`Source → Catalogue Document → Extraction → Special Candidate → Human Acceptance → Verified Special`

A document records where the catalogue came from and its content hash. An extraction records OCR/vision/LLM output and confidence. A candidate is the normalized offer proposed by extraction. Candidates are never publicly discoverable and are never inserted as verified specials by ingestion.

## API

### POST `/api/catalogue/documents`

Protected by the same ingestion token or admin `app_metadata.role` used by the specials ingestion API.

Creates a queued catalogue document. The caller supplies either `sourceUrl` or `storagePath`, plus the retailer and MIME type.

### POST `/api/catalogue/extractions`

Protected ingestion callback for OCR/vision/extraction workers. The endpoint records the extractor type/version, raw text, structured output and confidence, then marks the source document as processed.

Machine output is treated as untrusted input.

### POST `/api/catalogue/candidates`

Creates a pending special candidate from a completed extraction. The source retailer is checked against the document retailer. The candidate cannot be accepted until it has a product, special price and start time.

### POST `/api/catalogue/candidates/:id/accept`

Admin-only acceptance path. The database transaction creates the canonical special, captures the extraction/document as special evidence, and calls the atomic verification function. The candidate becomes `accepted` only if the entire transaction succeeds.

### POST `/api/catalogue/candidates/:id/reject`

Admin-only rejection path. The candidate is marked `rejected` with a review reason and does not create a public special.

## Security boundary

Catalogue tables are RLS-enabled and explicitly inaccessible to `anon` and `authenticated`. The service-role client is used only from server-side routes. Public discovery continues to rely on the existing verified-special RLS policy.

AI/OCR extraction does not have authority to verify an offer. Verification remains an explicit acceptance operation with evidence and an audit event.
