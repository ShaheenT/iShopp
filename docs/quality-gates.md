# Backend quality gates

Before a backend capability is considered complete:

- migration is deterministic and reviewed
- RLS policies cover every application table
- server authorization does not trust client identity fields
- API responses have explicit contracts
- invalid input is rejected at the boundary
- unit/integration tests cover critical logic
- Playwright verifies critical user journeys once the frontend exists
- secrets remain outside source control
- payment and financial state are server-authoritative

A feature is not complete because the UI renders successfully.
