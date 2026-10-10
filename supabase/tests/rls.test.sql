-- pgTAP test: proves one user cannot read or change another user's rows, and anonymous users see nothing.
-- Run with: supabase test db   (needs the Supabase CLI and Docker)
begin;
select plan(19);

-- Two users in auth.users (the trigger-free minimal columns).
insert into auth.users (id, email, aud, role)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'a@example.com', 'authenticated', 'authenticated'),
       ('bbbbbbbb-0000-4000-8000-000000000002', 'b@example.com', 'authenticated', 'authenticated');

-- Seed rows as the table owner (bypasses RLS).
insert into public.practices (id, owner, title, data, source, review_status)
values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A drill', '{}', 'user', 'edited_by_owner');
insert into public.sessions (id, owner, data)
values ('22222222-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '{}');
insert into public.shared_practices (id, owner, snapshot)
values ('sharedlink0001', 'aaaaaaaa-0000-4000-8000-000000000001', '{}');
insert into public.generations (owner, kind, input, valid)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'practice', '{}', true);
insert into public.reports (shared_id) values ('sharedlink0001');
insert into public.profiles (id, language) values ('aaaaaaaa-0000-4000-8000-000000000001', 'fr');

-- Act as user B ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);

select is((select count(*)::int from public.practices), 0, 'B cannot read A''s practices');
select is((select count(*)::int from public.sessions), 0, 'B cannot read A''s sessions');
select is((select count(*)::int from public.shared_practices), 0, 'B cannot read A''s shares');
select is((select count(*)::int from public.generations), 0, 'B cannot read A''s generations');
select is((select count(*)::int from public.profiles), 0, 'B cannot read A''s profile');

update public.practices set title = 'hacked' where id = '11111111-0000-4000-8000-000000000001';
delete from public.practices where id = '11111111-0000-4000-8000-000000000001';
update public.shared_practices set revoked_at = now() where id = 'sharedlink0001';

select throws_ok(
  $$insert into public.practices (owner, title, data, source, review_status)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'spoof', '{}', 'user', 'edited_by_owner')$$,
  '42501', null, 'B cannot insert a practice owned by A');
select throws_ok(
  $$insert into public.sessions (owner, data) values ('aaaaaaaa-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'B cannot insert a session owned by A');
select throws_ok(
  $$insert into public.shared_practices (id, owner, snapshot)
    values ('spoofedlink01', 'aaaaaaaa-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'B cannot create a share owned by A');
select throws_ok(
  $$insert into public.generations (owner, kind, input, valid) values ('bbbbbbbb-0000-4000-8000-000000000002', 'practice', '{}', true)$$,
  '42501', null, 'Users cannot write generations (service role only)');
select throws_ok($$select * from public.reports$$, '42501', null, 'Users cannot read reports');

-- B can create and read their own row.
insert into public.practices (id, owner, title, data, source, review_status)
values ('11111111-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'B drill', '{}', 'user', 'edited_by_owner');
select is((select count(*)::int from public.practices), 1, 'B sees only their own practice');

-- Back to the owner role to check that A's rows were untouched ------------------------------------
reset role;
select is((select title from public.practices where id = '11111111-0000-4000-8000-000000000001'), 'A drill', 'A''s practice title was not changed by B');
select is((select count(*)::int from public.practices where id = '11111111-0000-4000-8000-000000000001'), 1, 'A''s practice was not deleted by B');
select is((select revoked_at is null from public.shared_practices where id = 'sharedlink0001'), true, 'A''s share was not revoked by B');

-- Act as user A: sees their own rows ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
select is((select count(*)::int from public.practices), 1, 'A sees their own practice');
select is((select count(*)::int from public.shared_practices), 1, 'A sees their own share');

-- Anonymous: nothing at all -----------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.shared_practices$$, '42501', null, 'Anonymous cannot read shared_practices');
select throws_ok($$select * from public.practices$$, '42501', null, 'Anonymous cannot read practices');
select throws_ok($$select public.increment_share_views('sharedlink0001')$$, '42501', null, 'Anonymous cannot call the view counter');

select * from finish();
rollback;
