-- SCRIPT PEMBERSIH TRIGGER BERMASALAH
-- Jalankan ini di SQL Editor Supabase Anda.

-- 1. Hapus trigger pendaftaran otomatis jika ada (ini sering jadi biang kerok)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Pastikan tabel users tidak punya constraint yang aneh
-- Kita coba hps constraint username jika itu yang bikin error (opsional)
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_key;

-- 3. Pastikan kolom username boleh NULL dulu untuk tes pendaftaran
ALTER TABLE public.users ALTER COLUMN username DROP NOT NULL;

-- 4. Jalankan ulang pendaftaran dari aplikasi (setelah refresh browser)
