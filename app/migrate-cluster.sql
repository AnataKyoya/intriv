-- OPSIONAL, jalankan SETELAH kode baru ter-deploy di Vercel.
-- Membuang kolom lama; foto & data lain tidak terpengaruh.
alter table participants drop column if exists kelompok;
alter table participants drop column if exists tema;
