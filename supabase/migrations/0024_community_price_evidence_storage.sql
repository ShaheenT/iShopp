-- Evidence storage boundary for Snap / Scan community price contributions.
-- The bucket is private. Users may only write/read objects inside their own UUID folder.

insert into storage.buckets (id, name, public)
values ('community-price-evidence', 'community-price-evidence', false)
on conflict (id) do nothing;

create policy community_price_evidence_user_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-price-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy community_price_evidence_user_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'community-price-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);
