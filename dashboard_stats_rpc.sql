CREATE OR REPLACE FUNCTION get_dashboard_stats_v2(p_outlet_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sales NUMERIC;
  v_total_transactions INTEGER;
  v_gender_stats JSONB;
  v_age_stats JSONB;
  v_top_outlets JSONB; -- Untuk Grafik (Limit 10)
  v_all_outlets JSONB; -- Untuk Tabel (Tanpa Limit)
  v_top_products JSONB;
BEGIN
  -- 1. Hitung Total Sales & Transactions
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*)
  INTO v_total_sales, v_total_transactions
  FROM public.transactions
  WHERE (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  -- 2. Hitung Statistik Gender
  SELECT jsonb_object_agg(customer_gender, count)
  INTO v_gender_stats
  FROM (
    SELECT customer_gender, COUNT(*) as count
    FROM public.transactions
    WHERE (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY customer_gender
  ) t;

  -- 3. Hitung Statistik Umur
  SELECT jsonb_object_agg(customer_age_range, count)
  INTO v_age_stats
  FROM (
    SELECT customer_age_range, COUNT(*) as count
    FROM public.transactions
    WHERE (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY customer_age_range
  ) t;

  -- 4. DATA UNTUK GRAFIK (WAJIB LIMIT 10 AGAR RAPI)
  SELECT jsonb_agg(d)
  INTO v_top_outlets
  FROM (
    SELECT o.nama_outlet as name, SUM(t.total) as total
    FROM public.transactions t
    JOIN public.outlets o ON o.id = t.outlet_id
    WHERE (p_outlet_id IS NULL OR t.outlet_id = p_outlet_id)
    GROUP BY o.nama_outlet
    ORDER BY total DESC
    LIMIT 10
  ) d;

  -- 5. DATA UNTUK TABEL LENGKAP (TANPA LIMIT)
  SELECT jsonb_agg(d)
  INTO v_all_outlets
  FROM (
    SELECT o.nama_outlet as name, SUM(t.total) as total
    FROM public.transactions t
    JOIN public.outlets o ON o.id = t.outlet_id
    WHERE (p_outlet_id IS NULL OR t.outlet_id = p_outlet_id)
    GROUP BY o.nama_outlet
    ORDER BY total DESC
  ) d;

  -- 6. Hitung Produk Terlaris
  SELECT jsonb_agg(d)
  INTO v_top_products
  FROM (
    SELECT p.nama, SUM(ti.qty) as qty, SUM(ti.qty * ti.harga) as total
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    JOIN public.products p ON p.id = ti.product_id
    WHERE (p_outlet_id IS NULL OR t.outlet_id = p_outlet_id)
    GROUP BY p.nama
    ORDER BY qty DESC
    LIMIT 10
  ) d;

  RETURN jsonb_build_object(
    'total_sales', v_total_sales,
    'total_transactions', v_total_transactions,
    'gender_stats', COALESCE(v_gender_stats, '{}'::jsonb),
    'age_stats', COALESCE(v_age_stats, '{}'::jsonb),
    'outlet_sales', COALESCE(v_top_outlets, '[]'::jsonb), -- Top 10 untuk Grafik
    'all_outlet_sales', COALESCE(v_all_outlets, '[]'::jsonb), -- Lengkap untuk Tabel
    'top_products', COALESCE(v_top_products, '[]'::jsonb)
  );
END;
$$;
