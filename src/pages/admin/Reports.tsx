import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, cn } from '../../lib/utils';
import { toast } from 'sonner';
import { Download, Search, FileText, Store, Eye, ImageIcon, Loader2, Ticket, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Outlet, Transaction } from '../../types';

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'regular' | 'loyalty'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchInitialData();
  }, [selectedOutletId, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOutletId, selectedCategory, searchQuery]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: outletsData } = await supabase.from('outlets').select('*').order('nama_outlet');
      setOutlets(outletsData || []);
      await fetchTransactions();
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let allData: Transaction[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('transactions')
          .select('*, items:transaction_items(*, product:products(*)), outlet:outlets(*)', { count: 'exact' });

        // Server-side filters
        if (selectedOutletId !== 'all') {
          query = query.eq('outlet_id', selectedOutletId);
        }

        if (selectedCategory === 'loyalty') {
          query = query.eq('promo_type', 'loyalty_7mei');
        } else if (selectedCategory === 'regular') {
          query = query.or('promo_type.eq.regular,promo_type.is.null');
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < step || allData.length >= 10000) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }

      setTransactions(allData);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Gagal mengambil data transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionToDelete);
      
      if (error) throw error;
      
      toast.success('Transaksi berhasil dihapus');
      setTransactionToDelete(null);
      await fetchTransactions();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error('Gagal menghapus transaksi: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesOutlet = selectedOutletId === 'all' || t.outlet_id === selectedOutletId;
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'loyalty' ? t.promo_type === 'loyalty_7mei' : (t.promo_type === 'regular' || !t.promo_type));
    const matchesSearch = t.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.outlet?.nama_outlet?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOutlet && matchesCategory && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset ke halaman 1 saat filter berubah
  const handleFilterChange = (fn: () => void) => { fn(); setCurrentPage(1); };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // 1. Data Transaksi Sheet
    const txData = filteredTransactions.map(t => ({
      'ID Transaksi': t.id,
      'Waktu': new Date(t.created_at).toLocaleString('id-ID'),
      'Outlet': t.outlet?.nama_outlet || '-',
      'Promo': t.promo_type === 'loyalty_7mei' ? 'Loyalty 7 Mei' : 'Reguler',
      'Total Bayar': t.total,
      'Jenis Kelamin': t.customer_gender,
      'Umur': t.customer_age_range,
      'URL Struk': t.receipt_url
    }));
    const txSheet = XLSX.utils.json_to_sheet(txData);
    XLSX.utils.book_append_sheet(workbook, txSheet, "Data Transaksi");

    // 2. Demografi Sheet
    const genderStats = {
      'Laki-laki': filteredTransactions.filter(t => t.customer_gender === 'Laki-laki').length,
      'Perempuan': filteredTransactions.filter(t => t.customer_gender === 'Perempuan').length
    };
    const ageStats: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      ageStats[t.customer_age_range] = (ageStats[t.customer_age_range] || 0) + 1;
    });

    const demoData = [
      { Kategori: 'Jenis Kelamin', Label: 'Laki-laki', Jumlah: genderStats['Laki-laki'] },
      { Kategori: 'Jenis Kelamin', Label: 'Perempuan', Jumlah: genderStats['Perempuan'] },
      ...Object.entries(ageStats).map(([label, count]) => ({
        Kategori: 'Kelompok Umur',
        Label: label || 'Tidak Terisi',
        Jumlah: count
      }))
    ];
    const demoSheet = XLSX.utils.json_to_sheet(demoData);
    XLSX.utils.book_append_sheet(workbook, demoSheet, "Demografi");

    // 3. Produk Terlaris Sheet
    const productSales: Record<string, { nama: string, qty: number, total: number }> = {};
    filteredTransactions.forEach(t => {
      t.items?.forEach(item => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = { 
            nama: item.product?.nama || 'Produk', 
            qty: 0, 
            total: 0 
          };
        }
        productSales[item.product_id].qty += item.qty;
        productSales[item.product_id].total += (item.qty * item.harga);
      });
    });

    const topProductsData = Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .map(p => ({
        'Nama Produk': p.nama,
        'Jumlah Terjual': p.qty,
        'Total Penjualan': p.total
      }));
    const productsSheet = XLSX.utils.json_to_sheet(topProductsData);
    XLSX.utils.book_append_sheet(workbook, productsSheet, "Produk Terlaris");

    XLSX.writeFile(workbook, `Laporan_Lengkap_Campaign.xlsx`);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Laporan Campaign</h2>
          <p className="text-gray-500 font-medium">Monitoring transaksi, demografi, dan bukti struk per outlet.</p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={filteredTransactions.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-3xl font-black flex items-center justify-center gap-2 shadow-xl shadow-green-100 transition-all active:scale-95 disabled:opacity-50"
        >
          <Download className="w-6 h-6" />
          Download Laporan Lengkap (Excel)
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Store className="w-4 h-4" /> Filter Outlet
          </label>
          <select
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          >
            <option value="all">Semua Outlet (Global)</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.nama_outlet}</option>
            ))}
          </select>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Kategori Transaksi
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          >
            <option value="all">Semua Kategori</option>
            <option value="regular">Hanya Reguler</option>
            <option value="loyalty">Hanya Promo Milad</option>
          </select>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-3 md:col-span-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4" /> Cari Transaksi
          </label>
          <input
            type="text"
            placeholder="Cari berdasarkan ID Transaksi atau Nama Outlet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Transaksi</p>
          <p className="text-2xl font-black text-gray-900">{filteredTransactions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Penjualan</p>
          <p className="text-2xl font-black text-orange-600">
            {formatRupiah(filteredTransactions.reduce((acc, t) => acc + t.total, 0))}
          </p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 border-l-4 border-l-blue-500 text-blue-900">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Transaksi Promo</p>
          <p className="text-2xl font-black">{filteredTransactions.filter(t => t.promo_type === 'loyalty_7mei').length}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 border-l-4 border-l-orange-500 text-orange-900">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Transaksi Reguler</p>
          <p className="text-2xl font-black">{filteredTransactions.filter(t => t.promo_type !== 'loyalty_7mei').length}</p>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b bg-gray-50/50">
          <h3 className="text-xl font-black text-gray-900">Riwayat Transaksi & Bukti Struk</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Waktu</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Outlet</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipe</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail Produk</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Demografi</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-8 py-6"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : paginatedTransactions.length > 0 ? paginatedTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-orange-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <p className="font-bold text-gray-900 text-sm">{new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[10px] text-gray-400 font-bold">{new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-300" />
                      <span className="font-bold text-gray-700 text-sm">{t.outlet?.nama_outlet || '-'}</span>
                    </div>
                  </td>
                   <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <span className={cn(
                         "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tight",
                         t.promo_type === 'loyalty_7mei' ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
                       )}>
                         {t.promo_type === 'loyalty_7mei' ? 'Loyalty' : 'Reguler'}
                       </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      {t.items && t.items.length > 0 ? t.items.map(item => (
                        <span key={item.id} className="inline-flex items-center gap-1 text-[10px] font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full w-fit whitespace-nowrap">
                          {item.qty}× {item.product?.nama ?? `Produk (${item.product_id.slice(0,6)})`}
                        </span>
                      )) : (
                        <span className="text-[10px] text-gray-300 italic">Data lama</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit">{t.customer_gender}</span>
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit truncate max-w-[150px]">{t.customer_age_range}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-gray-900">{formatRupiah(t.total)}</td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center gap-2">
                      <a 
                        href={t.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm active:scale-95"
                      >
                        <Eye className="w-4 h-4" />
                        Lihat Struk
                      </a>
                      <button 
                        onClick={() => setTransactionToDelete(t.id)}
                        className="p-2 bg-white border border-gray-200 rounded-xl text-red-500 hover:border-red-500 hover:bg-red-50 transition-all shadow-sm active:scale-95"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-300">
                      <FileText className="w-16 h-16 opacity-20" />
                      <p className="font-bold">Tidak ada data transaksi ditemukan.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls - Pastikan di luar div overflow-x-auto */}
      {totalPages > 1 && (
        <div className="mt-6 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-gray-400">
            Halaman <span className="text-orange-600">{currentPage}</span> dari <span className="text-gray-900">{totalPages}</span> 
            <span className="mx-2 text-gray-200">|</span> 
            Total <span className="text-gray-900">{filteredTransactions.length}</span> Transaksi
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCurrentPage(prev => Math.max(1, prev - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-600 hover:border-orange-500 hover:text-orange-600 disabled:opacity-30 disabled:hover:border-gray-200 transition-all shadow-sm active:scale-95"
            >
              Sebelumnya
            </button>
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Hanya tampilkan halaman di sekitar current page jika terlalu banyak
                if (totalPages > 5 && Math.abs(pageNum - currentPage) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                  if (pageNum === 2 || pageNum === totalPages - 1) return <span key={pageNum} className="text-gray-300">...</span>;
                  return null;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setCurrentPage(pageNum);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      "w-10 h-10 rounded-xl text-xs font-bold transition-all",
                      currentPage === pageNum 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-200 scale-110" 
                        : "bg-white border border-gray-200 text-gray-400 hover:border-orange-500 hover:text-orange-600"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-600 hover:border-orange-500 hover:text-orange-600 disabled:opacity-30 disabled:hover:border-gray-200 transition-all shadow-sm active:scale-95"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-10 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-8 mx-auto">
              <Trash2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-center mb-4 text-gray-900">Hapus Transaksi?</h3>
            <p className="text-gray-500 text-center mb-10 leading-relaxed">
              Apakah Anda yakin ingin menghapus transaksi ini? Data yang sudah dihapus tidak dapat dikembalikan.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setTransactionToDelete(null)}
                className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteTransaction}
                disabled={isDeleting}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-xl shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
