# Local Service Finder BD

A Bengali-first local services marketplace for Bangladesh.

## What is implemented

- Customer and provider account flows powered by Supabase Auth.
- Provider onboarding with service area, experience, category, description and starting price.
- Public directory that exposes only approved providers and approved services.
- Search by category, district and keywords.
- Service detail pages and customer service-request submission.
- Separate customer/provider dashboards for sent and received requests.
- Provider request status updates.
- Admin queue for provider verification.
- Row Level Security policies and database-side approval guards.
- Public listings do not expose contact phone numbers.

## Important: backend setup required before real accounts can work

The frontend code is ready to use Supabase, but it does not contain a Supabase project URL or public anon/publishable key yet. **Do not put a Supabase service-role key in browser code.**

1. Create or connect a Supabase project.
2. Open the Supabase SQL Editor and run the complete file at `supabase/schema.sql`.
3. Copy the Project URL and the public anon/publishable key into `config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Configure the Supabase Auth email-confirmation and allowed redirect URLs for the deployed Vercel domain.
5. Deploy the `local-service-finder` folder as the Vercel site root.
6. Register the first trusted administrator account. In Supabase SQL Editor, find its UUID under Authentication > Users and run:
   `insert into public.admin_users(user_id) values ('AUTH_USER_UUID');`
7. Test with one customer account and one provider account. Approve the provider and their service from the admin page before expecting it in public search.

## Current deployment status

This repository contains the rebuilt application shell and Supabase-backed frontend. A real shared marketplace requires the Supabase project setup above. Until that setup is completed, no fake users, fake phone numbers or demo service providers are displayed.

## Security notes

- Only the public anon/publishable Supabase key belongs in `config.js`.
- Never expose a service-role key in frontend files or public GitHub repositories.
- Run the SQL schema before enabling account creation.
- Keep provider approval restricted to the administrator.
- Verify service-provider identity and agree on price/scope before arranging work.
