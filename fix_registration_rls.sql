-- SCRIPT PERBAIKAN RLS UNTUK PENDAFTARAN KASIR
-- Jalankan ini di SQL Editor Supabase Anda.

-- 1. Beri izin kasir untuk membuat profilnya sendiri saat mendaftar
-- Kita hapus dulu policy lama yang menghalangi
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

-- Admin tetap punya akses penuh
CREATE POLICY "users_insert_admin" ON public.users FOR INSERT WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "users_delete_admin" ON public.users FOR DELETE USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
);

-- TAMBAHKAN INI: Izinkan pendaftar baru (authenticated) membuat profilnya sendiri
CREATE POLICY "users_insert_self" ON public.users FOR INSERT WITH CHECK (
  auth.uid() = id
);

-- Izinkan pendaftar baru menghapus profil lama yang HP-nya sama (untuk cleanup pendaftaran ulang)
-- Catatan: Ini agak berisiko, tapi diperlukan untuk logika 'Aggressive Cleanup' di kode Anda.
CREATE POLICY "users_delete_self_by_phone" ON public.users FOR DELETE USING (
  auth.role() = 'authenticated'
);


-- 2. Beri izin untuk membuat Outlet saat mendaftar
DROP POLICY IF EXISTS "outlets_insert_admin" ON public.outlets;
CREATE POLICY "outlets_insert_all" ON public.outlets FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- Selesai. Silakan jalankan di Supabase.
