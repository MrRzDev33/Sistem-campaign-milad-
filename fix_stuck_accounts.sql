-- SCRIPT PERBAIKAN AKUN STUCK "OUTLET DMC"
-- Jalankan ini di SQL Editor Supabase Anda.

-- 1. Hapus akun kasir yang tidak memiliki outlet_id
-- Akun-akun inilah yang menyebabkan tampilan "General/Outlet DMC" tapi tidak bisa transaksi.
-- Dengan menghapusnya dari tabel profil, aplikasi akan memaksa mereka daftar ulang atau ditangani ulang oleh fetchUserProfile.
DELETE FROM public.users 
WHERE role = 'kasir' 
AND (outlet_id IS NULL OR outlet_id NOT IN (SELECT id FROM public.outlets));

-- 2. Pastikan kolom outlet_id di tabel users tidak boleh kosong di masa depan
-- Ini untuk mencegah akun "hantu" muncul lagi.
-- Jalankan ini HANYA jika Anda sudah yakin semua akun kasir saat ini sudah punya outlet.
-- ALTER TABLE public.users ALTER COLUMN outlet_id SET NOT NULL;

-- 3. Info: Anda bisa mengecek siapa saja yang terkena masalah ini dengan query:
-- SELECT * FROM public.users WHERE role = 'kasir' AND outlet_id IS NULL;
