-- FIX RLS PADA SUPABASE
-- Jalankan script ini di menu SQL Editor pada dashboard Supabase Anda.

-- 1. Pastikan RLS diaktifkan untuk tabel yang relevan
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

-- 2. Hapus policy lama (jika ada) untuk menghindari duplikat
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON transactions;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON transaction_items;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON products;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON outlets;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON product_prices;

-- 3. Buat policy baru yang mengizinkan SEMUA user login (Kasir & Admin) untuk membaca data
-- Ini penting agar Dashboard Admin dapat menampilkan semua transaksi, 
-- dan Kasir dapat melihat riwayat transaksi mereka sendiri.
CREATE POLICY "Enable read access for all authenticated users" 
ON transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" 
ON transaction_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" 
ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" 
ON outlets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users" 
ON product_prices FOR SELECT TO authenticated USING (true);

-- Catatan Tambahan:
-- Insert pada tabel transactions sudah ditangani oleh fungsi process_transaction_atomic 
-- yang memiliki hak akses SECURITY DEFINER (Bypass RLS), sehingga tidak perlu policy INSERT.
