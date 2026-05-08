import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Phone, Lock, MapPin, Loader2, Store, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { MasterOutlet } from '../types';

export default function RegisterKasirPage() {
  const navigate = useNavigate();
  const [masterOutlets, setMasterOutlets] = useState<MasterOutlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingOutlets, setFetchingOutlets] = useState(true);

  useEffect(() => {
    fetchMasterOutlets();
  }, []);

  const fetchMasterOutlets = async () => {
    try {
      const { data, error } = await supabase
        .from('master_outlets')
        .select('*')
        .order('nama');
      if (error) throw error;
      setMasterOutlets(data || []);
    } catch (error: any) {
      console.error('Error fetching master outlets:', error);
      toast.error('Gagal mengambil daftar outlet');
    } finally {
      setFetchingOutlets(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId) {
      toast.error('Silakan pilih outlet');
      return;
    }
    setLoading(true);

    try {
      const selectedOutlet = masterOutlets.find(o => o.id === selectedOutletId);
      const cleanPhone = phone.trim();
      const email = `${cleanPhone}@dmc.id`;
      // 1. Sign Up in Auth
      let authUser = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('User already registered') || authError.message.includes('already exists')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (signInError) {
            throw new Error('Nomor HP ini sudah terdaftar. Gunakan password yang benar atau hubungi Admin.');
          }
          authUser = signInData.user;
        } else {
          throw authError;
        }
      } else {
        authUser = authData.user;
      }

      // Jika authData.user ada tapi session kosong (karena email confirmation), kita tetap lanjut pakai ID-nya
      const targetUser = authUser || authData.user;

      if (targetUser) {
        // Gunakan RPC Register Kasir V2 (Sangat Robust & Bypass RLS)
        const { data: rpcData, error: rpcError } = await supabase.rpc('register_kasir_v2', {
          p_user_id: targetUser.id,
          p_email: email,
          p_phone: cleanPhone,
          p_address: address,
          p_role: 'kasir',
          p_outlet_name: selectedOutlet?.nama
        });

        if (rpcError || (rpcData && !rpcData.success)) {
          console.error('Registration RPC error:', rpcError || rpcData?.message);
          throw new Error(rpcError?.message || rpcData?.message || 'Gagal menyimpan profil kasir.');
        }

        toast.success('Pendaftaran berhasil! Silakan login.');
        await supabase.auth.signOut();
        navigate('/login');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border border-orange-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-orange-500 p-10 text-center relative overflow-hidden">
          <Link to="/login" className="absolute left-6 top-10 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">DAFTAR KASIR</h1>
          <p className="text-orange-100 text-sm font-medium">Lengkapi data outlet Anda</p>
        </div>

        <form onSubmit={handleRegister} className="p-8 space-y-6">
          <SearchableSelect
            label="Pilih Nama Outlet"
            required
            options={masterOutlets}
            value={selectedOutletId}
            onChange={setSelectedOutletId}
            placeholder={fetchingOutlets ? "Memuat..." : "Cari nama outlet..."}
          />

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Alamat Lengkap <span className="text-red-500">*</span></label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none min-h-[100px] transition-all"
                placeholder="Jl. Raya No. XX..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">No HP <span className="text-red-500">*</span></label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="0812XXXXXXXX"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              'Daftar Sekarang'
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-orange-600 font-bold hover:underline">
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
