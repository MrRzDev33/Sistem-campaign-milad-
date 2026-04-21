-- SCRIPT PERBAIKAN RACE CONDITION & REALTIME SUPABASE
-- Jalankan seluruh script ini di SQL Editor Supabase Anda

-- 1. Mengaktifkan fitur Realtime untuk tabel transactions
-- Ini sangat penting agar Kasir dan Admin bisa melihat sisa kuota yang ter-update 
-- secara otomatis tanpa perlu me-refresh halaman.
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- 2. Memperbarui Fungsi Transaksi dengan Advisory Lock
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
  v_lock_key BIGINT;
BEGIN
  -- Validasi Limit & Syarat Pembelian
  IF p_promo_type = 'loyalty_7mei' THEN
    v_limit := 100;
  ELSE
    v_limit := 5000;
  END IF;

  -- 🚨 PERBAIKAN RACE CONDITION: MENGGUNAKAN ADVISORY LOCK 🚨
  -- Menghasilkan angka unik (hash) berdasarkan tipe promo untuk dijadikan kunci gembok (lock key)
  v_lock_key := hashtext('promo_lock_' || p_promo_type);
  
  -- Mengunci proses ini di level transaksi database. 
  -- Jika ada 88 kasir menekan simpan bersamaan, mereka akan dipaksa mengantre 
  -- satu per satu dalam hitungan milidetik.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Setelah mendapat giliran (lock), baru kita hitung sisa kuota yang PALING AKURAT.
  v_current_count := (SELECT COUNT(*)::INTEGER FROM transactions WHERE promo_type = p_promo_type);

  IF v_current_count >= v_limit THEN
    -- Lock akan otomatis terlepas saat function ini melakukan RETURN.
    RETURN jsonb_build_object('success', false, 'message', 'Maaf, kuota untuk promo ini (' || v_limit || ') sudah habis direbut oleh kasir lain.');
  END IF;

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

  -- Transaksi sukses. Lock dilepas otomatis oleh PostgreSQL di akhir function.
  RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;
