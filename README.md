# iShopp

**Share More. Save More.**

# iShopp

**Share More. Save More.**

iShopp is being rebuilt as a production-grade shopping savings network that turns everyday shoppers into a real-time savings community.

## Product direction

The production platform will help people discover genuine specials and savings, compare value across retailers, save products to shopping lists, share useful finds with friends and family, and eventually move from discovery to checkout and fulfilment.

The backend is the source of truth. PostgreSQL/Supabase owns users, retailers, stores, products, specials, baskets, orders, payments and fulfilment state. AI may extract and classify information, but AI never authorizes transactions or changes financial truth.

## Architecture

- Next.js 15 App Router
- TypeScript
- Supabase PostgreSQL + Auth + Storage
- Row Level Security (RLS)
- Vercel deployment
- PayFast for South African payments
- Playwright for end-to-end verification

## Build strategy

Backend first. Frontend second.

The legacy `iShoppTest` repository is retained as a prototype/reference archive. Its useful product concepts, flows and domain knowledge may be selectively carried forward, but its Vite/Express/Drizzle architecture is not the production foundation.

Every production backend capability should ship with its database migration, authorization/RLS model, TypeScript implementation, API contract, automated tests and deployment-ready configuration.

## Core principle

**Share More. Save More.**

The objective is not simply another shopping app. iShopp is intended to become a trusted savings and shopping network where useful price intelligence can be discovered, shared and acted upon with a reliable transactional backend.
