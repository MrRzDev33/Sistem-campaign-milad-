-- 1. Create RPC to fetch current limits based on qty of items
CREATE OR REPLACE FUNCTION get_current_quotas()
RETURNS JSONB AS $$
DECLARE
  v_reg_qty INTEGER;
  v_loy_qty INTEGER;
BEGIN
  SELECT COALESCE(SUM(ti.qty), 0) INTO v_reg_qty 
  FROM transaction_items ti 
  JOIN transactions t ON t.id = ti.transaction_id 
  WHERE COALESCE(t.promo_type, 'regular') = 'regular';

  SELECT COALESCE(SUM(ti.qty), 0) INTO v_loy_qty 
  FROM transaction_items ti 
  JOIN transactions t ON t.id = ti.transaction_id 
  WHERE t.promo_type = 'loyalty_7mei';

  RETURN jsonb_build_object('regular', v_reg_qty, 'loyalty', v_loy_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update process_transaction_atomic to check SUM(qty)
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
  v_items_qty INTEGER;
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

  -- Menghasilkan angka unik (hash) berdasarkan tipe promo untuk dijadikan kunci gembok (lock key)
  v_lock_key := hashtext('promo_lock_' || p_promo_type);
  
  -- Mengunci proses ini di level transaksi database. 
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Hitung sisa kuota yang PALING AKURAT berdasarkan ITEM YANG TERJUAL
  SELECT COALESCE(SUM(ti.qty), 0)::INTEGER INTO v_current_count 
  FROM transaction_items ti 
  JOIN transactions t ON t.id = ti.transaction_id 
  WHERE COALESCE(t.promo_type, 'regular') = p_promo_type;

  -- Hitung total qty dari keranjang yang sedang di-checkout
  SELECT COALESCE(SUM((value->>'qty')::INTEGER), 0)::INTEGER INTO v_items_qty
  FROM jsonb_array_elements(p_items);

  IF (v_current_count + v_items_qty) > v_limit THEN
    -- Lock akan otomatis terlepas saat function ini melakukan RETURN.
    RETURN jsonb_build_object('success', false, 'message', 'Maaf, sisa kuota promo ini tidak mencukupi untuk pesanan Anda. Sisa kuota yang ada: ' || (v_limit - v_current_count) || ' produk.');
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
