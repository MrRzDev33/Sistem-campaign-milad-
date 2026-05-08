-- SCRIPT OPTIMASI PERFORMA DATABASE
-- Jalankan ini di SQL Editor Supabase Anda untuk mengurangi beban CPU/RAM.

-- 1. Index untuk tabel Transactions (Sangat Penting)
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON public.transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_promo_type ON public.transactions(promo_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- 2. Index untuk tabel Transaction Items (Penting untuk Join/Laporan)
CREATE INDEX IF NOT EXISTS idx_tx_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_items_product_id ON public.transaction_items(product_id);

-- 3. Index untuk tabel Product Prices (Penting untuk Kasir)
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_outlet_id ON public.product_prices(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_composite ON public.product_prices(product_id, outlet_id);

-- 4. Index untuk tabel Users
CREATE INDEX IF NOT EXISTS idx_users_outlet_id ON public.users(outlet_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 5. Vacuum & Analyze (Membantu optimizer Postgres memahami data baru)
ANALYZE public.transactions;
ANALYZE public.transaction_items;
ANALYZE public.product_prices;
ANALYZE public.users;
