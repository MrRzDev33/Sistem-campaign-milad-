-- MIGRATION: Add Promo Type and Loyalty Feature (FIXED VERSION)
-- Pastikan Anda menyorot (highlight) SELURUH kode ini lalu tekan RUN.

-- 1. Tambah kolom yang diperlukan jika belum ada
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS promo_type TEXT DEFAULT 'regular';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_loyalty BOOLEAN DEFAULT false;

-- 2. Masukkan produk khusus (Free Donat 1/2 Lusin Ultah 7 Mei)
INSERT INTO products (id, nama, harga_default, gambar_url, is_loyalty)
VALUES (
  '00000000-0000-0000-0000-000000000007', 
  'free donat ultah 7 Mei', 
  0, 
  'https://donatmaduindonesia.com/wp-content/uploads/2025/08/Logo-Website.svg',
  true
) ON CONFLICT (id) DO UPDATE SET is_loyalty = true, nama = 'free donat ultah 7 Mei';

-- 3. Hapus fungsi lama jika ada untuk menghindari konflik
DROP FUNCTION IF EXISTS process_transaction_atomic;

-- 4. Buat Fungsi Atomic Transaction
CREATE OR REPLACE FUNCTION process_transaction_atomic(
  p_id UUID,
  p_outlet_id UUID,
  p_user_id UUID,
  p_total NUMERIC,
  p_gender TEXT,
  p_age_range TEXT,
  p_receipt_url TEXT,
  p_promo_type TEXT,
  p_items JSONB
) RETURNS JSONB AS $body$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER;
  v_item JSONB;
  v_transaction_id UUID;
  v_reg_count INTEGER := 0;
BEGIN
  -- Validasi Limit & Syarat Pembelian (SANGAT SIMPEL: HANYA LIMIT KUOTA)
  -- Promo Loyalty 7 Mei: Limit 100
  -- Promo Reguler: Limit 5000
  IF p_promo_type = 'loyalty_7mei' THEN
    v_limit := 100;
  ELSE
    v_limit := 5000;
  END IF;

  -- HITUNG KUOTA (DENGAN LOCKING UNTUK ATOMICITY)
  v_current_count := (SELECT COUNT(*)::INTEGER FROM transactions WHERE promo_type = p_promo_type);

  IF v_current_count >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maaf, kuota untuk promo ini (' || v_limit || ') sudah terpenuhi.');
  END IF;

  -- TIDAK ADA VALIDASI MINIMAL ITEM LAIN. TRANSAKSI INI SAJA SUDAH CUKUP.

  -- SIMPAN TRANSAKSI
  INSERT INTO transactions (id, outlet_id, user_id, total, customer_gender, customer_age_range, receipt_url, promo_type, created_at)
  VALUES (p_id, p_outlet_id, p_user_id, p_total, p_gender, p_age_range, p_receipt_url, p_promo_type, NOW())
  RETURNING id INTO v_transaction_id;

  -- SIMPAN ITEM
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (id, transaction_id, product_id, qty, harga)
    VALUES (gen_random_uuid(), v_transaction_id, (v_item->>'product_id')::UUID, (v_item->>'qty')::INTEGER, (v_item->>'harga')::NUMERIC);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;
