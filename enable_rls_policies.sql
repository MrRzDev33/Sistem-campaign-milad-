-- SCRIPT MENGAKTIFKAN KEMBALI ROW LEVEL SECURITY (RLS) & POLICIES
-- Jalankan script ini di menu SQL Editor pada dashboard Supabase Anda.

-- 1. Membuat Fungsi Bantuan untuk Cek Role tanpa Infinite Recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 2. Mengaktifkan RLS pada semua tabel
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- 3. Hapus Policies Lama (Bila Ada) agar Bersih
DROP POLICY IF EXISTS "users_read_self" ON public.users;
DROP POLICY IF EXISTS "users_read_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_self" ON public.users;
DROP POLICY IF EXISTS "outlets_read_all" ON public.outlets;
DROP POLICY IF EXISTS "outlets_insert_admin" ON public.outlets;
DROP POLICY IF EXISTS "outlets_update_admin" ON public.outlets;
DROP POLICY IF EXISTS "outlets_delete_admin" ON public.outlets;
DROP POLICY IF EXISTS "products_read_all" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
DROP POLICY IF EXISTS "product_prices_read_all" ON public.product_prices;
DROP POLICY IF EXISTS "product_prices_insert_admin" ON public.product_prices;
DROP POLICY IF EXISTS "product_prices_update_admin" ON public.product_prices;
DROP POLICY IF EXISTS "product_prices_delete_admin" ON public.product_prices;
DROP POLICY IF EXISTS "transactions_read_self" ON public.transactions;
DROP POLICY IF EXISTS "transactions_read_admin" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_kasir" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_admin" ON public.transactions;
DROP POLICY IF EXISTS "tx_items_read_self" ON public.transaction_items;
DROP POLICY IF EXISTS "tx_items_read_admin" ON public.transaction_items;
DROP POLICY IF EXISTS "tx_items_insert_all" ON public.transaction_items;
DROP POLICY IF EXISTS "tx_items_delete_admin" ON public.transaction_items;

-- 4. Policies untuk Tabel users
-- Kasir bisa baca profilnya sendiri, Admin bisa baca semua
CREATE POLICY "users_read_self" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_read_admin" ON public.users FOR SELECT USING (public.get_user_role() = 'admin');
-- Admin bisa Insert, Update, Delete
CREATE POLICY "users_insert_admin" ON public.users FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "users_delete_admin" ON public.users FOR DELETE USING (public.get_user_role() = 'admin');
-- Kasir bisa update profil sendiri
CREATE POLICY "users_update_self" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 5. Policies untuk Tabel outlets
-- Semua (Kasir & Admin) bisa melihat daftar outlet
CREATE POLICY "outlets_read_all" ON public.outlets FOR SELECT USING (auth.role() = 'authenticated');
-- Hanya Admin yang bisa nambah/ubah/hapus
CREATE POLICY "outlets_insert_admin" ON public.outlets FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "outlets_update_admin" ON public.outlets FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "outlets_delete_admin" ON public.outlets FOR DELETE USING (public.get_user_role() = 'admin');

-- 6. Policies untuk Tabel products
-- Semua bisa melihat produk
CREATE POLICY "products_read_all" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
-- Hanya Admin yang bisa kelola
CREATE POLICY "products_insert_admin" ON public.products FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "products_update_admin" ON public.products FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "products_delete_admin" ON public.products FOR DELETE USING (public.get_user_role() = 'admin');

-- 7. Policies untuk Tabel product_prices
-- Semua bisa melihat harga
CREATE POLICY "product_prices_read_all" ON public.product_prices FOR SELECT USING (auth.role() = 'authenticated');
-- Hanya Admin yang bisa kelola
CREATE POLICY "product_prices_insert_admin" ON public.product_prices FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "product_prices_update_admin" ON public.product_prices FOR UPDATE USING (public.get_user_role() = 'admin');
CREATE POLICY "product_prices_delete_admin" ON public.product_prices FOR DELETE USING (public.get_user_role() = 'admin');

-- 8. Policies untuk Tabel transactions
-- Kasir melihat transaksinya sendiri, Admin melihat semua
CREATE POLICY "transactions_read_self" ON public.transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "transactions_read_admin" ON public.transactions FOR SELECT USING (public.get_user_role() = 'admin');
-- Kasir bisa insert transaksi
CREATE POLICY "transactions_insert_kasir" ON public.transactions FOR INSERT WITH CHECK (user_id = auth.uid());
-- Admin bisa insert transaksi (opsional, jika perlu manual input)
CREATE POLICY "transactions_insert_admin" ON public.transactions FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
-- Admin bisa hapus (untuk fitur Reset Data)
CREATE POLICY "transactions_delete_admin" ON public.transactions FOR DELETE USING (public.get_user_role() = 'admin');

-- 9. Policies untuk Tabel transaction_items
-- Kasir melihat item transaksinya sendiri
CREATE POLICY "tx_items_read_self" ON public.transaction_items FOR SELECT USING (
  transaction_id IN (SELECT id FROM public.transactions WHERE user_id = auth.uid())
);
-- Admin melihat semua
CREATE POLICY "tx_items_read_admin" ON public.transaction_items FOR SELECT USING (public.get_user_role() = 'admin');
-- Semua bisa insert (dilindungi oleh RPC atau logic backend)
CREATE POLICY "tx_items_insert_all" ON public.transaction_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Admin bisa hapus (untuk fitur Reset Data)
CREATE POLICY "tx_items_delete_admin" ON public.transaction_items FOR DELETE USING (public.get_user_role() = 'admin');

-- Selesai! Database Anda kini aman.
