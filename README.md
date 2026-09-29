# Foto Peserta Intrivia

Next.js + Supabase, siap deploy ke Vercel.

## 1. Supabase
1. Buat project di supabase.com.
2. SQL Editor → jalankan isi `supabase/schema.sql`, lalu `supabase/seed.sql` (430 peserta).
3. Settings → API: salin **Project URL** dan **anon public key**.

## 2. Jalankan lokal (opsional)
```
cp .env.example .env.local   # isi URL & anon key
npm install
npm run dev
```

## 3. Deploy ke Vercel
1. Push folder ini ke GitHub, lalu Vercel → Add New Project → import repo.
2. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Buka URL-nya dari HP; kamera hanya jalan lewat HTTPS (Vercel sudah HTTPS).

Catatan: karena tanpa login, siapa pun yang punya URL bisa mengunggah foto. Cukup untuk pemakaian pribadi; jangan bagikan link-nya.
