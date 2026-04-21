import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { formatRupiah, cn } from '../../lib/utils';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Search, Image as ImageIcon, Loader2, X, Store } from 'lucide-react';
import imageCompression from 'browser-image-compression';

import { useDemoStore } from '../../store';

export default function ProductManagement() {
  const { outlets, productPrices, setProductPrices, setProducts: setDemoProducts } = useDemoStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterOutlet, setSelectedFilterOutlet] = useState<string>('all');

  // Form state
  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [outletPrices, setOutletPrices] = useState<Record<string, string>>({});
  const [isLoyalty, setIsLoyalty] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (productsError) throw productsError;

      const { data: pricesData, error: pricesError } = await supabase
        .from('product_prices')
        .select('*');
      
      if (pricesError) throw pricesError;

      const finalProducts = productsData || [];
      const finalPrices = pricesData || [];

      setProducts(finalProducts);
      setDemoProducts(finalProducts);
      setProductPrices(finalPrices);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setDemoProducts([]);
      setProductPrices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setNama(product.nama);
      setHarga(product.harga_default.toString());
      
      // Load existing outlet assignments and prices
      const assignedPrices = productPrices.filter(pp => pp.product_id === product.id);
      const assignedOutletIds = assignedPrices.map(pp => pp.outlet_id);
      const pricesMap: Record<string, string> = {};
      assignedPrices.forEach(pp => {
        pricesMap[pp.outlet_id] = pp.harga.toString();
      });
      
      setSelectedOutlets(assignedOutletIds);
      setOutletPrices(pricesMap);
      setIsLoyalty(product.is_loyalty || false);
    } else {
      setEditingProduct(null);
      setNama('');
      setHarga('');
      setSelectedOutlets([]);
      setOutletPrices({});
      setIsLoyalty(false);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const toggleOutlet = (outletId: string) => {
    setSelectedOutlets(prev => {
      if (prev.includes(outletId)) {
        return prev.filter(id => id !== outletId);
      } else {
        return [...prev, outletId];
      }
    });
    
    if (!outletPrices[outletId]) {
      setOutletPrices(prev => ({
        ...prev,
        [outletId]: harga // Default to global price
      }));
    }
  };

  const handleOutletPriceChange = (outletId: string, value: string) => {
    setOutletPrices(prev => ({
      ...prev,
      [outletId]: value
    }));
  };

  const uploadImage = async (file: File) => {
    // Compression options
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };

    let fileToUpload = file;
    try {
      fileToUpload = await imageCompression(file, options);
    } catch (error) {
      console.warn('Image compression failed, uploading original:', error);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `product-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('products')
      .upload(filePath, fileToUpload);

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let imageUrl = editingProduct?.gambar_url || '';
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const productData = {
        nama,
        harga_default: parseInt(harga),
        gambar_url: imageUrl,
        is_loyalty: isLoyalty,
      };

      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        productId = crypto.randomUUID();
        const { data, error } = await supabase
          .from('products')
          .insert([{ id: productId, ...productData }])
          .select()
          .single();
        
        if (error) {
          console.error('Supabase Insert Error:', error);
          throw error;
        }
      }

      // Update product prices
      // First, delete old prices for this product
      const { error: deleteError } = await supabase
        .from('product_prices')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) throw deleteError;

      // Insert new prices
      if (selectedOutlets.length > 0) {
        const newPrices = selectedOutlets.map(outletId => ({
          product_id: productId,
          outlet_id: outletId,
          harga: parseInt(outletPrices[outletId] || harga)
        }));

        const { error: insertPricesError } = await supabase
          .from('product_prices')
          .insert(newPrices);
        
        if (insertPricesError) {
          if (insertPricesError.message.includes('violates foreign key constraint')) {
            throw new Error('Gagal menyimpan: Anda memilih Outlet Demo. Silakan buat Outlet asli terlebih dahulu di menu Manajemen Outlet.');
          }
          throw insertPricesError;
        }
      }

      toast.success(editingProduct ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      let msg = error.message;
      if (msg.includes('row-level security policy')) {
        msg = 'Izin Ditolak (RLS). Silakan jalankan perintah "DISABLE ROW LEVEL SECURITY" di SQL Editor Supabase Anda.';
      }
      toast.error('Gagal menyimpan produk: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', itemToDelete);
      
      if (error) throw error;
      
      toast.success('Produk berhasil dihapus');
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk: ' + error.message);
    } finally {
      setSubmitting(false);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOutlet = selectedFilterOutlet === 'all' || 
      productPrices.some(pp => pp.product_id === p.id && pp.outlet_id === selectedFilterOutlet);
    return matchesSearch && matchesOutlet;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Manajemen Produk</h2>
          <p className="text-gray-500">Kelola katalog donat untuk campaign Milad.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-200 transition-all"
        >
          <Plus className="w-5 h-5" />
          Tambah Produk
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-gray-400" />
          <select
            value={selectedFilterOutlet}
            onChange={(e) => setSelectedFilterOutlet(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium"
          >
            <option value="all">Semua Outlet</option>
            {outlets.map(outlet => (
              <option key={outlet.id} value={outlet.id}>{outlet.nama_outlet}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-3xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const assignedOutletsCount = productPrices.filter(pp => pp.product_id === product.id).length;
            return (
              <div key={product.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 group">
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {product.gambar_url ? (
                    <img 
                      src={product.gambar_url} 
                      alt={product.nama} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(product)}
                      className="p-2 bg-white/90 backdrop-blur rounded-xl text-orange-600 hover:bg-orange-500 hover:text-white transition-all shadow-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="p-2 bg-white/90 backdrop-blur rounded-xl text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {assignedOutletsCount > 0 && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-gray-600 shadow-sm">
                      {assignedOutletsCount} Outlet
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-gray-900 mb-1">{product.nama}</h4>
                  <p className="text-orange-600 font-bold">{formatRupiah(product.harga_default)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
            <div className="p-6 border-b flex items-center justify-between bg-orange-500 text-white">
              <h3 className="text-xl font-bold">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Nama Produk</label>
                    <input
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Contoh: Donat Madu Original"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Harga Default Pusat (Rp)</label>
                    <input
                      type="number"
                      required
                      value={harga}
                      onChange={(e) => setHarga(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="7500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Gambar Produk</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-xs text-gray-500">
                            {imageFile ? imageFile.name : 'Klik untuk upload gambar'}
                          </p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-2xl cursor-pointer bg-gray-50 hover:bg-orange-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isLoyalty}
                        onChange={(e) => setIsLoyalty(e.target.checked)}
                        className="w-5 h-5 rounded-lg text-orange-500 focus:ring-orange-500"
                      />
                      <div>
                        <p className="font-bold text-gray-900">Produk Promo Milad</p>
                        <p className="text-xs text-gray-500">Kuota dibatasi 100 secara global</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-700 block">Ketersediaan & Harga per Outlet</label>
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-4 max-h-[350px] overflow-y-auto space-y-3">
                    {outlets.map(outlet => {
                      const isSelected = selectedOutlets.includes(outlet.id);
                      
                      return (
                        <div key={outlet.id} className={cn(
                          "p-4 rounded-2xl border transition-all space-y-3",
                          isSelected ? "bg-white border-orange-200 shadow-sm" : "bg-transparent border-gray-100 opacity-60"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleOutlet(outlet.id)}
                                className="w-5 h-5 rounded-lg text-orange-500 focus:ring-orange-500"
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                  {outlet.nama_outlet}
                                </span>
                                <span className="text-[10px] text-gray-400 line-clamp-1">{outlet.alamat}</span>
                              </div>
                            </div>
                          </div>
                          
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">Harga:</span>
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                                <input 
                                  type="number"
                                  value={outletPrices[outlet.id] || harga}
                                  onChange={(e) => handleOutletPriceChange(outlet.id, e.target.value)}
                                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 italic">* Produk hanya akan muncul di akun kasir outlet yang dicentang.</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-2">Konfirmasi Hapus</h3>
            <p className="text-gray-500 mb-8">Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.</p>
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
