-- DANGER: deletes ALL TradeMate SA tables and data. Only use to start over.
-- After running this, run 001_initial_schema.sql again.
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.jobs, public.quotation_items, public.quotations,
                     public.customers, public.businesses cascade;
drop function if exists public.current_business_id();
drop function if exists public.handle_new_user();
drop function if exists public.generate_quote_number();
drop function if exists public.set_updated_at();
