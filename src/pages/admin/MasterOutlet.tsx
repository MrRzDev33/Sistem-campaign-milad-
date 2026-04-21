import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MasterOutlet } from '../../types';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Loader2, X, Store, Edit2, Upload } from 'lucide-react';
import { useRef } from 'react';

export default function MasterOutletManagement() {
  const [outlets, setOutlets] = useState<MasterOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<MasterOutlet | null>(null);
  const [nama, setNama] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('master_outlets')
        .select('*')
        .order('nama');
      if (error) throw error;
      setOutlets(data || []);
    } catch (error: any) {
      console.error('Error fetching outlets:', error);
      toast.error('Gagal mengambil data outlet');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (outlet?: MasterOutlet) => {
    if (outlet) {
      setEditingOutlet(outlet);
      setNama(outlet.nama);
    } else {
      setEditingOutlet(null);
      setNama('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingOutlet) {
        const { error } = await supabase
          .from('master_outlets')
          .update({ nama })
          .eq('id', editingOutlet.id);
        if (error) throw error;
        toast.success('Outlet berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('master_outlets')
          .insert([{ id: crypto.randomUUID(), nama }]);
        if (error) throw error;
        toast.success('Outlet berhasil ditambahkan');
      }
      setIsModalOpen(false);
      fetchOutlets();
    } catch (error: any) {
      console.error('Error saving outlet:', error);
      toast.error(error.message || 'Gagal menyimpan outlet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus nama outlet ini?')) return;
    
    try {
      const { error } = await supabase
        .from('master_outlets')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Outlet berhasil dihapus');
      fetchOutlets();
    } catch (error: any) {
      console.error('Error deleting outlet:', error);
      toast.error('Gagal menghapus outlet');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain') {
      toast.error('Harap unggah file .txt');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) {
        toast.error('File kosong');
        setLoading(false);
        return;
      }

      try {
        // Get existing outlet names to avoid duplicates
        const { data: existingData, error: fetchError } = await supabase
          .from('master_outlets')
          .select('nama');
        
        if (fetchError) throw fetchError;

        const existingNames = new Set(existingData?.map(o => o.nama.toLowerCase()) || []);
        const newOutlets = lines
          .filter(name => !existingNames.has(name.toLowerCase()))
          .map(name => ({
            id: crypto.randomUUID(),
            nama: name
          }));

        if (newOutlets.length === 0) {
          toast.info('Semua nama outlet di file sudah terdaftar');
          setLoading(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('master_outlets')
          .insert(newOutlets);

        if (insertError) throw insertError;

        toast.success(`${newOutlets.length} outlet baru berhasil ditambahkan`);
        fetchOutlets();
      } catch (error: any) {
        console.error('Error uploading outlets:', error);
        toast.error('Gagal mengunggah data outlet');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const filteredOutlets = outlets.filter(o => 
    o.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Master Nama Outlet</h2>
          <p className="text-gray-500 font-medium">Kelola daftar nama outlet resmi yang dapat dipilih oleh Kasir.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-8 py-4 rounded-3xl font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <Upload className="w-6 h-6" />
            Upload File .txt
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-3xl font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-100 transition-all active:scale-95"
          >
            <Plus className="w-6 h-6" />
            Tambah Nama Outlet
          </button>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Cari nama outlet..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-orange-500 outline-none shadow-sm transition-all"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-3xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOutlets.map((outlet) => (
            <div key={outlet.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50 flex items-center justify-between group hover:border-orange-200 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{outlet.nama}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Terdaftar</p>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenModal(outlet)}
                  className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(outlet.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredOutlets.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 font-medium">
              Belum ada data outlet.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b flex items-center justify-between bg-gray-900 text-white">
              <h3 className="text-xl font-black tracking-tight">{editingOutlet ? 'Edit Nama Outlet' : 'Tambah Nama Outlet'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Nama Outlet Resmi</label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  placeholder="Contoh: DMC Cihanjuang"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-3xl font-black shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Simpan Data'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
