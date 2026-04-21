import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, useCartStore, useDemoStore, useAppStore } from '../../store';
import { Product, Transaction, Gender, AgeRange } from '../../types';
import { formatRupiah, getDailyReminder, setDailyReminderSeen, cn } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  Search, ShoppingCart, Plus, Minus, Trash2, Save, 
  ImageIcon, Loader2, X, History, CheckCircle2, AlertCircle, Ticket, LogOut, Users
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';

export default function KasirPage() {
  const { user, setUser } = useAuthStore();
  const { 
    items, addItem, removeItem, updateQty, clearCart, total,
    isCartOpen, setIsCartOpen, receiptPreview, setReceiptPreview
  } = useCartStore();
  const { transactions, setTransactions, products: demoProducts, productPrices, setProducts: setDemoProducts, setProductPrices } = useDemoStore();
  const { transactionCount, loyaltyCount, logoUrl } = useAppStore();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedProductForQty, setSelectedProductForQty] = useState<Product | null>(null);
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [selectedLoyaltyProductModal, setSelectedLoyaltyProductModal] = useState<Product | null>(null);

  const REGULAR_LIMIT = 5000;
  const LOYALTY_LIMIT = 100;
  const WARNING_THRESHOLD = 4995;
  const LOYALTY_ID = '00000000-0000-0000-0000-000000000007';

  useEffect(() => {
    fetchProducts();
    fetchTransactions();
    if (getDailyReminder()) {
      setShowReminder(true);
    }
  }, [user?.outlet_id]);

  useEffect(() => {
    if (transactionCount >= WARNING_THRESHOLD && transactionCount < REGULAR_LIMIT) {
      setShowLimitWarning(true);
    } else {
      setShowLimitWarning(false);
    }
  }, [transactionCount]);

  const fetchTransactions = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setTransactions(data || []);
      
      // Update global counts for limit protection based on user's transactions
      const regCount = (data || [])
        .filter(tx => tx.promo_type === 'regular')
        .length;
      const loyCount = (data || [])
        .filter(tx => tx.promo_type === 'loyalty_7mei')
        .length;
        
      useAppStore.getState().setTransactionCount(regCount);
      useAppStore.getState().setLoyaltyCount(loyCount);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('nama');
      
      if (productsError) throw productsError;

      const { data: pricesData, error: pricesError } = await supabase
        .from('product_prices')
        .select('*');
      
      if (pricesError) throw pricesError;

      const finalProductsData = productsData || [];
      const finalPricesData = pricesData || [];

      // Update store with latest data
      setDemoProducts(finalProductsData);
      setProductPrices(finalPricesData);

      let allProducts = finalProductsData;
      
      // Filter products based on outlet availability
      if (user?.outlet_id) {
        const availableProductIds = finalPricesData
          .filter(pp => pp.outlet_id === user.outlet_id)
          .map(pp => pp.product_id);
        
        const filteredByOutlet = allProducts.filter(p => availableProductIds.includes(p.id));
        setProducts(filteredByOutlet);
      } else {
        setProducts(allProducts);
      }
    } catch (e: any) {
      console.error('Error fetching products:', e);
      setProducts([]);
      setDemoProducts([]);
      setProductPrices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    // In a real app, we'd fetch from Supabase
  };

  const [customerGender, setCustomerGender] = useState<Gender>(() => (localStorage.getItem('dmc_last_gender') as Gender) || '');
  const [customerAgeRange, setCustomerAgeRange] = useState<AgeRange>(() => (localStorage.getItem('dmc_last_age') as AgeRange) || '');

  useEffect(() => {
    localStorage.setItem('dmc_last_gender', customerGender);
  }, [customerGender]);

  useEffect(() => {
    localStorage.setItem('dmc_last_age', customerAgeRange);
  }, [customerAgeRange]);

  const getProductPrice = (productId: string) => {
    const price = productPrices.find(p => p.product_id === productId && p.outlet_id === user?.outlet_id);
    return price ? price.harga : products.find(p => p.id === productId)?.harga_default || 0;
  };

  const uploadReceipt = async (file: File) => {
    // Compression options
    const options = {
      maxSizeMB: 0.5, // Max size 500KB
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    };

    let fileToUpload = file;
    try {
      const compressedFile = await imageCompression(file, options);
      fileToUpload = new File([compressedFile], file.name, { type: file.type });
    } catch (error) {
      console.error('Compression error:', error);
      // Fallback to original file if compression fails
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${user?.id || 'anonymous'}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('transactions')
      .upload(filePath, fileToUpload);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('transactions')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setIsProcessingImage(true);
    try {
      // 1. Compress immediately
      const options = {
        maxSizeMB: 0.2, // Small enough for base64 storage
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedBlob = await imageCompression(file, options);
      
      // 2. Conver to Base64 for persistence
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setReceiptPreview(base64data);
        setReceiptFile(file);
        setIsProcessingImage(false);
      };
    } catch (e) {
      console.error('Initial processing error:', e);
      setIsProcessingImage(false);
      setReceiptFile(file); // Fallback
    }
  };

  const base64ToFile = (base64String: string, filename: string): File => {
    const arr = base64String.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSaveTransaction = async () => {
    if (items.length === 0) {
      toast.error('Keranjang masih kosong');
      return;
    }
    if (!receiptPreview && !receiptFile) {
      toast.error('Harap upload foto struk');
      return;
    }
    if (!customerGender) {
      toast.error('Harap pilih jenis kelamin customer');
      return;
    }
    if (!customerAgeRange) {
      toast.error('Harap pilih kelompok umur customer');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const hasLoyalty = items.some(item => item.id === LOYALTY_ID);

      // Validasi & Refresh Sesi jika perlu
      let currentUser = user;
      if (!currentUser?.id || !currentUser?.outlet_id) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: freshProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          
          if (freshProfile) {
            currentUser = freshProfile;
            setUser(freshProfile);
          } else {
            throw new Error('Data profil kasir belum terdaftar di database.');
          }
        } else {
          throw new Error('Sesi login berakhir. Silakan login kembali.');
        }
      }

      if (!currentUser?.outlet_id) {
        throw new Error('Akun Anda belum terhubung ke outlet manapun.');
      }

      let fileToUpload = receiptFile;
      if (!fileToUpload && receiptPreview) {
        fileToUpload = base64ToFile(receiptPreview, `receipt_${Date.now()}.png`);
      }

      if (!fileToUpload) throw new Error('Foto struk tidak ditemukan');

      const receiptUrl = await uploadReceipt(fileToUpload);
      const transactionId = crypto.randomUUID();
      const promoType = hasLoyalty ? 'loyalty_7mei' : 'regular';

      // Atomic RPC call for limit protection
      const { data: rpcResult, error: rpcError } = await supabase.rpc('process_transaction_atomic', {
        p_id: transactionId,
        p_outlet_id: currentUser.outlet_id,
        p_user_id: currentUser.id,
        p_total: total,
        p_gender: customerGender,
        p_age_range: customerAgeRange,
        p_receipt_url: receiptUrl,
        p_promo_type: promoType,
        p_items: items.map(item => ({
          product_id: item.id,
          qty: item.qty,
          harga: getProductPrice(item.id)
        }))
      });

      if (rpcError) throw rpcError;
      
      if (!rpcResult || !rpcResult.success) {
        throw new Error(rpcResult?.message || 'Gagal memproses transaksi di server');
      }

      toast.success('Transaksi berhasil disimpan');
      
      // Fetch latest data to update history and counts
      await fetchTransactions();
      
      clearCart();
      setReceiptFile(null);
      setReceiptPreview(null);
      setCustomerGender('');
      setCustomerAgeRange('');
      localStorage.removeItem('dmc_last_gender');
      localStorage.removeItem('dmc_last_age');
      fetchTransactions();
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      toast.error(error.message || 'Gagal menyimpan transaksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    toast.success('Berhasil keluar');
    navigate('/login');
  };

  const filteredProducts = products.filter(p => 
    p.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loyaltyProduct = products.find(p => p.is_loyalty || p.id === LOYALTY_ID);

  const handleOpenQtyModal = (product: Product) => {
    setSelectedProductForQty(product);
    setQtyToAdd(1);
  };

  const handleConfirmAdd = () => {
    if (selectedProductForQty) {
      addItem(selectedProductForQty, getProductPrice(selectedProductForQty.id), qtyToAdd);
      setSelectedProductForQty(null);
      toast.success(`${selectedProductForQty.nama} ditambahkan ke keranjang`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Kasir Header */}
      <header className="bg-white border-b sticky top-0 z-40 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src="https://donatmaduindonesia.com/wp-content/uploads/2025/08/Logo-Website.svg" 
            alt="Logo" 
            className="h-8 w-auto" 
          />
          <div className="hidden md:block h-6 w-px bg-gray-200"></div>
          <div className="hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Kasir Outlet</p>
            <p className="text-sm font-black text-gray-900">{user?.outlet?.nama_outlet || 'Outlet DMC'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowHistory(true)}
            className="p-3 bg-gray-50 text-gray-600 rounded-2xl hover:bg-orange-50 hover:text-orange-600 transition-all"
            title="Riwayat Transaksi"
          >
            <History className="w-6 h-6" />
          </button>
          <button 
            onClick={handleLogout}
            className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all"
            title="Keluar"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-8 flex flex-col lg:flex-row gap-8 overflow-hidden">
        {/* Product Catalog */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
              />
            </div>
          </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-3xl"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const isLoyalty = product.is_loyalty || product.id === LOYALTY_ID;
              
              return (
                <button
                  key={product.id}
                  onClick={() => {
                    if (isLoyalty) {
                      if (loyaltyCount >= LOYALTY_LIMIT) {
                        toast.error('Maaf, kuota promo ultah sudah habis.');
                        return;
                      }
                      setSelectedLoyaltyProductModal(product);
                      setShowLoyaltyModal(true);
                    } else {
                      handleOpenQtyModal(product);
                    }
                  }}
                  disabled={isLoyalty && loyaltyCount >= LOYALTY_LIMIT}
                  className={cn(
                    "bg-white p-3 rounded-3xl shadow-sm border border-gray-100 text-left group transition-all active:scale-95 flex flex-col relative",
                    isLoyalty ? "border-yellow-400 bg-yellow-50/30 hover:border-yellow-600" : "hover:border-orange-500",
                    isLoyalty && loyaltyCount >= LOYALTY_LIMIT && "opacity-50 grayscale"
                  )}
                >
                  {isLoyalty && (
                    <div className="absolute top-2 right-2 z-10 bg-yellow-500 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <Ticket className="w-2 h-2" />
                      PROMO UNTUKMU
                    </div>
                  )}
                  
                  <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-3 relative">
                    {product.gambar_url ? (
                      <img src={product.gambar_url} alt={product.nama} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                    <div className={cn(
                      "absolute inset-0 transition-colors",
                      isLoyalty ? "bg-yellow-500/0 group-hover:bg-yellow-500/10" : "bg-orange-500/0 group-hover:bg-orange-500/10"
                    )}></div>
                  </div>
                  
                  <h4 className={cn(
                    "font-bold text-sm line-clamp-2 mb-1 flex-1",
                    isLoyalty ? "text-yellow-900" : "text-gray-900"
                  )}>
                    {product.nama}
                  </h4>
                  
                  {isLoyalty ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-yellow-600 font-black text-xs">GRATIS!</p>
                      <p className="text-[9px] text-yellow-700 font-bold">Limit: {loyaltyCount}/{LOYALTY_LIMIT}</p>
                    </div>
                  ) : (
                    <p className="text-orange-600 font-bold text-sm">{formatRupiah(getProductPrice(product.id))}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      <div className={cn(
        "w-full lg:w-[400px] bg-white lg:rounded-3xl shadow-xl border border-gray-100 flex flex-col overflow-hidden lg:sticky lg:top-8 h-full lg:h-[calc(100vh-120px)] transition-all duration-300 z-[60]",
        "fixed inset-0 lg:relative lg:inset-auto",
        isCartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
      )}>
        <div className="p-6 border-b bg-orange-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            <h3 className="text-xl font-bold">Keranjang</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
              {items.reduce((acc, i) => acc + i.qty, 0)} Item
            </span>
            <button onClick={() => setIsCartOpen(false)} className="lg:hidden p-1 hover:bg-white/20 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p className="text-sm font-medium">Belum ada produk dipilih</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 group">
                <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                  {item.gambar_url ? (
                    <img src={item.gambar_url} alt={item.nama} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-gray-900 text-sm truncate">{item.nama}</h5>
                  <p className="text-xs text-gray-500">{formatRupiah(item.harga_default)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button 
                      onClick={() => {
                        updateQty(item.id, item.qty - 1);
                      }}
                      className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Jenis Kelamin</label>
              <select 
                value={customerGender}
                onChange={(e) => setCustomerGender(e.target.value as Gender)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Pilih</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Kelompok Umur</label>
              <select 
                value={customerAgeRange}
                onChange={(e) => setCustomerAgeRange(e.target.value as AgeRange)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Pilih</option>
                <option value="13–17 tahun (Remaja/Teens)">13–17 tahun (Remaja/Teens)</option>
                <option value="18–24 tahun (Dewasa Muda/Gen Z)">18–24 tahun (Dewasa Muda/Gen Z)</option>
                <option value="25–34 tahun (Milenial Muda)">25–34 tahun (Milenial Muda)</option>
                <option value="35–44 tahun (Milenial Matang/Gen X)">35–44 tahun (Milenial Matang/Gen X)</option>
                <option value="45–54 tahun (Gen X)">45–54 tahun (Gen X)</option>
                <option value="55–64 tahun & 65+ (Boomers/Senior)">55–64 tahun & 65+ (Boomers/Senior)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Upload Struk Penjualan</label>
              {(/Samsung|Sharp/i.test(navigator.userAgent)) && (
                <span className="text-[9px] font-bold text-orange-400 animate-pulse italic">Tip: Jika HP restart, pilih opsi Galeri</span>
              )}
            </div>
            <div className="relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden" 
                id="receipt-upload" 
              />
              <label 
                htmlFor="receipt-upload"
                className={cn(
                  "w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
                  (receiptPreview || receiptFile) 
                    ? "border-green-500 bg-green-50 text-green-700" 
                    : "border-gray-300 hover:border-orange-500 text-gray-500"
                )}
              >
                {isProcessingImage ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (receiptPreview || receiptFile) ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-bold truncate max-w-[200px]">Struk Siap</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-sm font-bold">Ambil Foto Struk</span>
                  </>
                )}
              </label>
            </div>
            {(receiptPreview) && (
              <div className="mt-2 relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                <img src={receiptPreview} className="w-full h-full object-contain" alt="Preview Struk" />
                <button 
                  onClick={() => {
                    setReceiptPreview(null);
                    setReceiptFile(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">Total Bayar</span>
            <span className="text-2xl font-black text-orange-600">{formatRupiah(total)}</span>
          </div>

          <button
            onClick={handleSaveTransaction}
            disabled={isSubmitting || items.length === 0 || 
              (items.some(i => i.id === LOYALTY_ID) ? loyaltyCount >= LOYALTY_LIMIT : transactionCount >= REGULAR_LIMIT)
            }
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (items.some(i => i.id === LOYALTY_ID) ? loyaltyCount >= LOYALTY_LIMIT : transactionCount >= REGULAR_LIMIT) ? (
              <>
                <X className="w-6 h-6" />
                Limit Tercapai
              </>
            ) : (
              <>
                <Save className="w-6 h-6" />
                Simpan Transaksi
              </>
            )}
          </button>
          
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest px-1">
              <span className="text-gray-400">Kuota Reguler</span>
              <span className={transactionCount >= REGULAR_LIMIT ? "text-red-500" : "text-gray-500"}>
                {transactionCount} / {REGULAR_LIMIT}
              </span>
            </div>
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", transactionCount >= REGULAR_LIMIT ? "bg-red-500" : "bg-orange-500")}
                style={{ width: `${Math.min(100, (transactionCount / REGULAR_LIMIT) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest px-1 pt-1">
              <span className="text-blue-500">Sisa Kuota Promo Milad</span>
              <span className={loyaltyCount >= LOYALTY_LIMIT ? "text-red-500" : "text-blue-600"}>
                {LOYALTY_LIMIT - loyaltyCount} Lagi
              </span>
            </div>
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", loyaltyCount >= LOYALTY_LIMIT ? "bg-red-500" : "bg-blue-500")}
                style={{ width: `${Math.min(100, (loyaltyCount / LOYALTY_LIMIT) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Cart Button for Mobile */}
      <button 
        onClick={() => setIsCartOpen(true)}
        className="lg:hidden fixed bottom-8 right-8 w-16 h-16 bg-orange-500 text-white rounded-full shadow-2xl flex items-center justify-center z-50 animate-bounce"
      >
        <div className="relative">
          <ShoppingCart className="w-8 h-8" />
          {items.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {items.reduce((acc, i) => acc + i.qty, 0)}
            </span>
          )}
        </div>
      </button>
    </div>

      {/* Quantity Selection Modal */}
      {selectedProductForQty && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="aspect-square bg-gray-50 rounded-3xl overflow-hidden mb-6">
              {selectedProductForQty.gambar_url ? (
                <img src={selectedProductForQty.gambar_url} alt={selectedProductForQty.nama} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImageIcon className="w-16 h-16" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">{selectedProductForQty.nama}</h3>
            <p className="text-orange-600 font-bold mb-6">{formatRupiah(getProductPrice(selectedProductForQty.id))}</p>
            
            <div className="flex items-center justify-center gap-6 mb-8">
              <button 
                onClick={() => setQtyToAdd(Math.max(1, qtyToAdd - 1))}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors"
              >
                <Minus className="w-6 h-6" />
              </button>
              <span className="text-2xl font-black w-8 text-center">{qtyToAdd}</span>
              <button 
                onClick={() => setQtyToAdd(qtyToAdd + 1)}
                className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedProductForQty(null)}
                className="py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmAdd}
                className="bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 transition-all active:scale-95"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <AlertCircle className="w-12 h-12 text-orange-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-4">Halo Kasir!</h3>
            <p className="text-gray-500 mb-10 leading-relaxed">
              Sudah input penjualan hari ini? Jangan lupa catat setiap transaksi ya!
            </p>
            <button
              onClick={() => {
                setShowReminder(false);
                setDailyReminderSeen();
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-3xl font-bold shadow-xl shadow-orange-200 transition-all active:scale-95"
            >
              Siap, Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Limit Warning Modal */}
      {showLimitWarning && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-300 border-4 border-orange-500">
            <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-200">
              <Ticket className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-4">Peringatan Limit!</h3>
            <div className="bg-orange-50 p-4 rounded-2xl mb-8">
              <p className="text-orange-900 font-bold text-lg">
                Sisa {REGULAR_LIMIT - transactionCount} Transaksi Lagi
              </p>
              <p className="text-orange-600 text-sm font-medium mt-1">
                Kuota Reguler: {transactionCount} / {REGULAR_LIMIT}
              </p>
            </div>
            <p className="text-gray-500 mb-10 text-sm leading-relaxed">
              Kuota transaksi hampir habis. Harap segera selesaikan transaksi yang tersisa atau hubungi admin pusat.
            </p>
            <button
              onClick={() => setShowLimitWarning(false)}
              className="w-full bg-gray-900 hover:bg-black text-white py-5 rounded-3xl font-bold shadow-xl transition-all active:scale-95"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
       {/* Loyalty Confirmation Modal */}
      {showLoyaltyModal && selectedLoyaltyProductModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 md:p-8 text-white flex-shrink-0">
              <div className="flex items-center gap-4 mb-1">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Ticket className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-xl md:text-2xl font-black">Konfirmasi Promo</h3>
              </div>
              <p className="text-white/80 text-xs md:text-sm font-medium">Verifikasi syarat & ketentuan berikut</p>
            </div>

            <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 custom-scrollbar">
              {/* Syarat untuk Customer */}
              <div>
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Syarat & Ketentuan Customer
                </h4>
                <ul className="space-y-3">
                  {[
                    'Menunjukkan identitas asli (KTP/Identitas)',
                    'Bersedia upload story dan tag @donatmaduindonesia',
                    'Khusus tanggal 7 & 8 Mei'
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                      </div>
                      <span className="text-sm font-bold text-gray-700 leading-tight">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Instruksi untuk Kasir */}
              <div className="bg-blue-50 border border-blue-100 p-4 md:p-5 rounded-2xl md:rounded-3xl">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> Instruksi Kasir
                </h4>
                <p className="text-sm font-bold text-blue-900 leading-relaxed">
                  Hanya upload foto struk belanja saja. 
                  <span className="block text-blue-600/70 mt-1 font-medium">TIDAK PERLU foto KTP customer.</span>
                </p>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t bg-gray-50 grid grid-cols-2 gap-4 flex-shrink-0">
              <button
                onClick={() => {
                  setShowLoyaltyModal(false);
                  setSelectedLoyaltyProductModal(null);
                }}
                className="py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-500 hover:bg-white transition-all border border-gray-200"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  addItem(selectedLoyaltyProductModal, 0, 1);
                  setShowLoyaltyModal(false);
                  setSelectedLoyaltyProductModal(null);
                  toast.success('Promo ditambahkan!');
                }}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black shadow-lg shadow-orange-100 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Klaim
              </button>
            </div>
          </div>
        </div>
      )}
      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex items-center justify-between bg-gray-900 text-white">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <History className="w-6 h-6" />
                Riwayat Transaksi Terakhir
              </h3>
              <button onClick={() => setShowHistory(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {transactions.filter(tx => tx.user_id === user?.id).map((tx) => (
                <div key={tx.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{formatRupiah(tx.total)}</p>
                    <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex gap-2">
                    <a 
                      href={tx.receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-white text-gray-600 rounded-xl border hover:bg-gray-50 transition-colors"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-center text-gray-400 py-12">Belum ada riwayat transaksi.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
