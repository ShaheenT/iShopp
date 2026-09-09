# Immediate next backend slice

The next implementation slice is the trusted specials API.

It will expose read-only discovery for verified active specials and server-side administration for ingestion/verification. Product and retailer identifiers are database-backed UUIDs. Client-provided prices and verification flags are never trusted without server-side validation.

After that, the ingestion pipeline will accept catalogue data, normalize products, attach source evidence and place records into a pending verification state before public discovery.
