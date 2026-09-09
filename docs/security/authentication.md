# Authentication security boundary

Supabase Auth is the identity provider for iShopp.

The browser uses the public Supabase client. Server Components and server-side route handlers use the SSR client so the authenticated session is carried through request cookies. The service-role client is restricted to server-side administrative workflows and must never be exposed to browser code.

Application authorization remains separate from authentication. A valid session does not grant retailer administration or access to another shopper's private records. PostgreSQL RLS remains the final data-access boundary.

Server-side code should prefer `auth.getUser()` when it needs a verified current user. Client-provided user IDs are never accepted as proof of identity.
