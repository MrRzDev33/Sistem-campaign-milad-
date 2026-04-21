-- SCRIPT PERBAIKAN RLS (DISABLE ROW LEVEL SECURITY)
-- Jalankan script ini di menu SQL Editor pada dashboard Supabase Anda.

-- Menghapus (disable) RLS agar semua fitur Edit, Tambah, dan Hapus (Admin) 
-- serta fitur Simpan Transaksi (Kasir) dapat berjalan tanpa hambatan "Izin Ditolak".

ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Selesai! Setelah ini dijalankan, Anda bisa mencoba menambahkan/mengedit produk lagi.
