-- FUNGSI SAKTI UNTUK PENDAFTARAN KASIR (BYPASS RLS)
-- Jalankan ini di SQL Editor Supabase Anda.

CREATE OR REPLACE FUNCTION public.register_kasir_v2(
  p_user_id UUID,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_role TEXT,
  p_outlet_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Ini yang membuatnya sakti (bypass RLS)
AS $$
DECLARE
  v_outlet_id UUID;
  v_username TEXT;
BEGIN
  -- 1. Cari atau Buat Outlet
  SELECT id INTO v_outlet_id FROM public.outlets WHERE nama_outlet = p_outlet_name LIMIT 1;
  
  IF v_outlet_id IS NULL THEN
    v_outlet_id := gen_random_uuid();
    INSERT INTO public.outlets (id, nama_outlet, alamat, provinsi)
    VALUES (v_outlet_id, p_outlet_name, p_address, 'Jawa Barat');
  END IF;

  -- 2. Bersihkan profil lama dengan No HP yang sama (jika ada)
  -- Ini mencegah error "Duplicate Key" saat daftar ulang
  DELETE FROM public.users WHERE phone = p_phone AND id != p_user_id;

  -- 3. Buat Username unik
  v_username := lower(replace(p_outlet_name, ' ', '_')) || '_' || p_phone;

  -- 4. Simpan/Update Profil User
  INSERT INTO public.users (id, email, username, role, outlet_id, phone, address)
  VALUES (p_user_id, p_email, v_username, p_role, v_outlet_id, p_phone, p_address)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    outlet_id = EXCLUDED.outlet_id,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address;

  RETURN jsonb_build_object('success', true, 'outlet_id', v_outlet_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
