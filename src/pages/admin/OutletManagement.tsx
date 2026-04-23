import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Outlet, User } from '../../types';
import { toast } from 'sonner';
import { Plus, Store, UserPlus, Trash2, MapPin, Phone, Loader2, X, Save, Edit2 } from 'lucide-react';

import { useDemoStore } from '../../store';

export default function OutletManagement() {
  const { 
    setOutlets: setDemoOutlets,
    setKasirs: setDemoKasirs
  } = useDemoStore();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [kasirs, setKasirs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingKasir, setEditingKasir] = useState<User | null>(null);

  // Form state
  const [namaOutlet, setNamaOutlet] = useState('');
  const [alamat, setAlamat] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const PROVINSI_LIST = [
    'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'DKI Jakarta', 'Banten', 'DI Yogyakarta', 'Sumatera Barat', 'Jambi'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: outletsData, error: outletsError } = await supabase
        .from('outlets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (outletsError) throw outletsError;

      const { data: kasirsData, error: kasirsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'kasir');
      
      if (kasirsError) throw kasirsError;

      const finalOutlets = outletsData || [];
      const finalKasirs = kasirsData || [];

      setOutlets(finalOutlets);
      setDemoOutlets(finalOutlets);
      setKasirs(finalKasirs);
      setDemoKasirs(finalKasirs);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setOutlets([]);
      setKasirs([]);
      setDemoOutlets([]);
      setDemoKasirs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUnified = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const cleanPhone = phone.trim();
      // 0. Aggressive Cleanup: Remove any existing profile with this phone number
      // This prevents "Unique constraint" errors if the Auth ID doesn't match the existing profile ID
      await supabase
        .from('users')
        .delete()
        .eq('phone', cleanPhone);

      // 1. Create or Get Outlet
      let outletId;
      const { data: existingOutlet } = await supabase
        .from('outlets')
        .select('id')
        .eq('nama_outlet', namaOutlet)
        .maybeSingle();

      if (existingOutlet) {
        outletId = existingOutlet.id;
      } else {
        const newOutletId = crypto.randomUUID();
        const { error: outletError } = await supabase
          .from('outlets')
          .insert([{
            id: newOutletId,
            nama_outlet: namaOutlet,
            alamat,
            provinsi
          }]);
        
        if (outletError) throw outletError;
        outletId = newOutletId;
      }

      // 2. Create Kasir User in Supabase Auth
      const email = `${cleanPhone}@dmc.id`;
      let authUser = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('User already registered') || authError.message.includes('already exists')) {
          // Fallback: try to sign in to get the user object
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (signInError) {
            throw new Error('Nomor HP ini sudah terdaftar di sistem keamanan. Silakan gunakan password yang sama seperti pendaftaran sebelumnya, atau hubungi Admin Pusat untuk reset total.');
          }
          authUser = signInData.user;
        } else {
          throw authError;
        }
      } else {
        authUser = authData.user;
      }

      if (authUser) {
        // 3. Create Kasir Profile in public users table
        const { error: kasirError } = await supabase
          .from('users')
          .upsert([{
            id: authUser.id,
            email,
            username: `${namaOutlet.toLowerCase().replace(/\s+/g, '_')}_${cleanPhone}`,
            role: 'kasir',
            outlet_id: outletId,
            phone: cleanPhone,
            address: alamat
          }], { onConflict: 'id' });
        
        if (kasirError) throw kasirError;
      }

      toast.success('Outlet dan Akun Kasir berhasil didaftarkan');
      setIsOutletModalOpen(false);
      fetchData();
      
      // Reset form
      setNamaOutlet('');
      setAlamat('');
      setProvinsi('');
      setPhone('');
      setPassword('');
    } catch (error: any) {
      console.error('Error saving outlet:', error);
      let msg = error.message;
      if (msg.includes('row-level security policy')) {
        msg = 'Izin Ditolak (RLS). Silakan jalankan perintah "DISABLE ROW LEVEL SECURITY" di SQL Editor Supabase Anda.';
      }
      toast.error('Gagal menyimpan data: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditKasir = (kasir: User) => {
    setEditingKasir(kasir);
    setEditPhone(kasir.phone || '');
    setEditAddress(kasir.address || '');
    setEditPassword('');
    setIsEditModalOpen(true);
  };

  const handleUpdateKasir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKasir) return;
    setSubmitting(true);

    try {
      const cleanPhone = editPhone.trim();
      const newEmail = `${cleanPhone}@dmc.id`;
      
      // 1. Update Supabase Auth via Admin API
      const authUpdateResponse = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingKasir.id,
          email: newEmail,
          password: editPassword || undefined
        })
      });

      if (!authUpdateResponse.ok) {
        let errorMessage = 'Gagal memperbarui akun login';
        try {
          const errData = await authUpdateResponse.json();
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          const text = await authUpdateResponse.text();
          console.error('API Error Response:', text);
          errorMessage = `Error ${authUpdateResponse.status}: ${text || authUpdateResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // 2. Update profile in database
      const outlet = outlets.find(o => o.id === editingKasir.outlet_id);
      const outletName = outlet?.nama_outlet || 'outlet';

      const { error: profileError } = await supabase
        .from('users')
        .update({
          phone: cleanPhone,
          address: editAddress,
          email: newEmail,
          username: `${outletName.toLowerCase().replace(/\s+/g, '_')}_${cleanPhone}`,
        })
        .eq('id', editingKasir.id);

      if (profileError) throw profileError;

      toast.success('Data kasir dan akun login berhasil diperbarui');
      setIsEditModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error updating kasir:', error);
      toast.error('Gagal memperbarui data: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKasir = async (kasirId: string) => {
    if (!confirm('PERINGATAN: Menghapus akun ini akan menghapus PROFIL dan AKUN LOGIN (Nomor HP & Password) secara permanen dari sistem. Lanjutkan?')) return;
    setSubmitting(true);
    try {
      // 1. Delete from Supabase Auth via Admin API
      const authDeleteResponse = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: kasirId })
      });

      if (!authDeleteResponse.ok) {
        try {
          const errData = await authDeleteResponse.json();
          console.warn('Gagal menghapus dari Auth (mungkin sudah terhapus):', errData.error);
        } catch (e) {
          const text = await authDeleteResponse.text();
          console.warn('Gagal menghapus dari Auth (Response bukan JSON):', text);
        }
      }

      // 2. Delete from users table
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', kasirId);
      
      if (error) throw error;
      
      toast.success('Akun kasir dan login berhasil dihapus total');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting kasir:', error);
      toast.error('Gagal menghapus kasir: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDeleteOutlet = async (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setSubmitting(true);
    try {
      // Find the kasir associated with this outlet to delete their auth account too
      const kasirToDelete = kasirs.find(k => k.outlet_id === itemToDelete);
      
      if (kasirToDelete) {
        const authDeleteResponse = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: kasirToDelete.id })
        });
        
        if (!authDeleteResponse.ok) {
          try {
            const errData = await authDeleteResponse.json();
            console.warn('Gagal menghapus kasir dari Auth:', errData.error);
          } catch (e) {
            const text = await authDeleteResponse.text();
            console.warn('Gagal menghapus kasir dari Auth (Response bukan JSON):', text);
          }
        }
      }

      const { error } = await supabase
        .from('outlets')
        .delete()
        .eq('id', itemToDelete);
      
      if (error) throw error;
      
      toast.success('Outlet dan akun login terkait berhasil dihapus total');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting outlet:', error);
      toast.error('Gagal menghapus outlet: ' + error.message);
    } finally {
      setSubmitting(false);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-12 pb-12">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Manajemen Outlet & Kasir</h2>
          <p className="text-gray-500">Daftarkan outlet baru beserta akun kasir operasionalnya.</p>
        </div>
        <button
          onClick={() => setIsOutletModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 font-bold"
        >
          <Plus className="w-5 h-5" />
          Daftar Outlet & Kasir Baru
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <section className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-500" />
            Daftar Outlet Aktif
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-3xl"></div>)
            ) : outlets.map((outlet) => {
              const kasir = kasirs.find(k => k.outlet_id === outlet.id);
              return (
                <div key={outlet.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col justify-between group hover:border-orange-200 transition-all">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                        <Store className="w-6 h-6" />
                      </div>
                      <button 
                        onClick={() => handleDeleteOutlet(outlet.id)}
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{outlet.nama_outlet}</h4>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{outlet.provinsi}</p>
                      <p className="text-sm text-gray-500 flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {outlet.alamat}
                      </p>
                    </div>
                  </div>
                  
                    <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 truncate">{kasir?.phone || 'Belum ada No HP'}</p>
                          <p className="text-[10px] text-gray-400 truncate">{kasir?.username || 'Belum ada akun'}</p>
                        </div>
                      </div>
                      {kasir && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleEditKasir(kasir)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit Akun Kasir"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteKasir(kasir.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus Akun Kasir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {kasir?.address && (
                      <div className="mt-2 flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-500 flex-shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] text-gray-500 line-clamp-2">{kasir.address}</p>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Edit Kasir Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex items-center justify-between bg-blue-600 text-white">
              <h3 className="text-xl font-bold">Edit Akun Kasir</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateKasir} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">No HP</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Alamat Kasir</label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Password Baru (Opsional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Isi jika ingin ganti password"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Unified Modal */}
      {isOutletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
            <div className="p-8 border-b flex items-center justify-between bg-gray-900 text-white">
              <div>
                <h3 className="text-2xl font-bold">Pendaftaran Outlet & Kasir</h3>
                <p className="text-gray-400 text-sm">Lengkapi data outlet dan akun kasir sekaligus.</p>
              </div>
              <button onClick={() => setIsOutletModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddUnified} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Outlet Info */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-orange-500 uppercase tracking-[0.2em]">Informasi Outlet</h4>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nama Outlet</label>
                    <input
                      type="text"
                      required
                      value={namaOutlet}
                      onChange={(e) => setNamaOutlet(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                      placeholder="Contoh: DMC Cihanjuang"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Provinsi</label>
                    <select
                      required
                      value={provinsi}
                      onChange={(e) => setProvinsi(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    >
                      <option value="">Pilih Provinsi...</option>
                      {PROVINSI_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Alamat Lengkap</label>
                    <textarea
                      required
                      value={alamat}
                      onChange={(e) => setAlamat(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none min-h-[120px] transition-all"
                      placeholder="Jl. Nama Jalan No. XX..."
                    />
                  </div>
                </div>

                {/* Kasir Info */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em]">Akun Kasir</h4>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">No HP</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="0812XXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-3xl font-bold shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-95 mt-4"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <Save className="w-6 h-6" />
                    Daftarkan Sekarang
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-2">Konfirmasi Hapus</h3>
            <p className="text-gray-500 mb-8">Apakah Anda yakin ingin menghapus outlet ini? Semua data kasir terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
