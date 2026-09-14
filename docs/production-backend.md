# iShopp production backend build

This branch completes the backend contracts around SNAP → SCAN → SHARE → BUY.

## Runtime prerequisites
- Supabase project URL
- Supabase anon key
- Supabase service-role key (server only)
- PayFast sandbox credentials for checkout verification
- AI provider credentials for optional scan enrichment

## Live verification gate
Repository code is complete only when the hosted Supabase migrations, Vercel environment variables, PayFast sandbox and end-to-end flows have been executed against the real deployment. Never treat repository presence as live verification.
