-- SCRIPT PERLINDUNGAN DATA RIWAYAT TRANSAKSI
-- Menjalankan script ini akan memastikan bahwa jika sebuah Outlet, Akun Kasir, atau Produk dihapus,
-- data riwayat transaksi penjualannya TIDAK AKAN ikut terhapus (hilang) ataupun menyebabkan database crash.
-- Nilai yang berkaitan (seperti siapa kasirnya) akan otomatis menjadi NULL, tetapi total keuangannya tetap aman.

DO $$
DECLARE
    fk_name text;
BEGIN
    ---------------------------------------------------------
    -- 1. Mengubah Relasi transactions -> users (Kasir)
    ---------------------------------------------------------
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'transactions' AND column_name = 'user_id'
      AND position_in_unique_constraint IS NOT NULL;
    
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || fk_name;
    END IF;
    -- Buat ulang dengan aturan SET NULL
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

    ---------------------------------------------------------
    -- 2. Mengubah Relasi transactions -> outlets
    ---------------------------------------------------------
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'transactions' AND column_name = 'outlet_id'
      AND position_in_unique_constraint IS NOT NULL;
    
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || fk_name;
    END IF;
    -- Buat ulang dengan aturan SET NULL
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_outlet FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE SET NULL;

    ---------------------------------------------------------
    -- 3. Mengubah Relasi transaction_items -> products
    ---------------------------------------------------------
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'transaction_items' AND column_name = 'product_id'
      AND position_in_unique_constraint IS NOT NULL;
    
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transaction_items DROP CONSTRAINT ' || fk_name;
    END IF;
    -- Buat ulang dengan aturan SET NULL
    ALTER TABLE public.transaction_items ADD CONSTRAINT fk_txitems_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

    ---------------------------------------------------------
    -- 4. Mengubah Relasi transaction_items -> transactions
    -- Ini tetap CASCADE, karena jika transaksinya dihapus (Reset), itemnya harus ikut terhapus.
    ---------------------------------------------------------
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'transaction_items' AND column_name = 'transaction_id'
      AND position_in_unique_constraint IS NOT NULL;
    
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transaction_items DROP CONSTRAINT ' || fk_name;
    END IF;
    ALTER TABLE public.transaction_items ADD CONSTRAINT fk_txitems_tx FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

    ---------------------------------------------------------
    -- 5. Mengubah Relasi product_prices -> products & outlets
    -- Ini CASCADE, jika produk/outlet dihapus, harga spesifiknya juga hilang
    ---------------------------------------------------------
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'product_prices' AND column_name = 'product_id'
      AND position_in_unique_constraint IS NOT NULL;
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.product_prices DROP CONSTRAINT ' || fk_name;
    END IF;
    ALTER TABLE public.product_prices ADD CONSTRAINT fk_prices_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'product_prices' AND column_name = 'outlet_id'
      AND position_in_unique_constraint IS NOT NULL;
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.product_prices DROP CONSTRAINT ' || fk_name;
    END IF;
    ALTER TABLE public.product_prices ADD CONSTRAINT fk_prices_outlet FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE CASCADE;

END $$;
