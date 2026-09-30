-- Jalankan di Supabase > SQL Editor (sekali saja), lalu jalankan seed.sql
create table if not exists participants (
  nim text primary key,
  nama text not null,
  prodi text,
  cluster int,
  photo_url text,
  photo_updated_at timestamptz
);
create index if not exists participants_nama_idx on participants (lower(nama));

alter table participants enable row level security;
create policy "baca peserta" on participants for select using (true);
create policy "update foto peserta" on participants for update using (true) with check (true);

-- Bucket foto (publik)
insert into storage.buckets (id, name, public) values ('photos','photos',true)
on conflict (id) do nothing;

create policy "baca foto" on storage.objects for select using (bucket_id = 'photos');
create policy "unggah foto" on storage.objects for insert with check (bucket_id = 'photos');
create policy "timpa foto" on storage.objects for update using (bucket_id = 'photos');
