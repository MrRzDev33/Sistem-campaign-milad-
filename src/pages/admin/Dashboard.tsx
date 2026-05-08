import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, cn } from '../../lib/utils';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, Users, Store, ShoppingBag, Trophy, Globe, Ticket, Trash2, Search } from 'lucide-react';
import { Transaction, Product, Outlet } from '../../types';

import { useDemoStore, useAppStore } from '../../store';

export default function Dashboard() {
  const {
    setTransactions: setDemoTransactions,
    setProducts: setDemoProducts,
    setOutlets: setDemoOutlets
  } = useDemoStore();
  const { transactionCount, setTransactionCount, loyaltyCount, setLoyaltyCount } = useAppStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [localStats, setLocalStats] = useState<any>(null);

  const [viewMode, setViewMode] = useState<'global' | 'outlet'>('global');
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const [resetType, setResetType] = useState<'transactions' | 'all'>('transactions');
  const [rankingPage, setRankingPage] = useState(1);
  const [rankingSearch, setRankingSearch] = useState('');
  const RANKING_PAGE_SIZE = 10;

  useEffect(() => {
    fetchData();

    // Listen for new transactions
    const channel = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        // Sinkronisasi angka kuota secara instan (paling realtime)
        fetchQuotas();
        
        // Refresh data dashboard lainnya bisa sedikit delay/manual jika ingin lebih hemat,
        // tapi untuk sekarang kita tetap panggil fetchData agar grafik terupdate.
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, selectedOutletId]);

  const fetchQuotas = async () => {
    try {
      const { data: quotaData } = await supabase.rpc('get_current_quotas');
      if (quotaData) {
        setTransactionCount(quotaData.regular || 0);
        setLoyaltyCount(quotaData.loyalty || 0);
      }
    } catch (e) {
      console.error('Error fetching quotas:', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats_v2', {
        p_outlet_id: viewMode === 'outlet' ? selectedOutletId : null
      });

      if (rpcError) throw rpcError;
      setLocalStats(rpcData);

      // Fetch newest transactions for the list (limited to 50 for performance)
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*, items:transaction_items(*, product:products(*)), outlet:outlets(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: productsData } = await supabase.from('products').select('*');
      const { data: outletsData } = await supabase.from('outlets').select('*').order('nama_outlet');

      if (transactionsData) setTransactions(transactionsData);
      if (productsData) setProducts(productsData);
      if (outletsData) setOutlets(outletsData);

      // Sync stores
      setDemoProducts(productsData || []);
      setDemoOutlets(outletsData || []);

      await fetchQuotas();
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    setResetStep(3);
    setLoading(true);
    try {
      // 0. Hapus file gambar dari Storage terlebih dahulu agar tidak memakan kuota
      const { data: txWithImages } = await supabase.from('transactions').select('receipt_url').not('receipt_url', 'is', null);
      if (txWithImages && txWithImages.length > 0) {
        const filePaths = txWithImages.map(t => {
          if (!t.receipt_url) return null;
          const parts = t.receipt_url.split('/transactions/');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          for (let i = 0; i < filePaths.length; i += 100) {
            await supabase.storage.from('transactions').remove(filePaths.slice(i, i + 100));
          }
        }
      }

      if (resetType === 'all') {
        const { data: prodWithImages } = await supabase.from('products').select('gambar_url').not('gambar_url', 'is', null);
        if (prodWithImages && prodWithImages.length > 0) {
          const prodPaths = prodWithImages.map(p => {
            if (!p.gambar_url) return null;
            const parts = p.gambar_url.split('/products/');
            return parts.length > 1 ? parts[1] : null;
          }).filter(Boolean) as string[];

          if (prodPaths.length > 0) {
            for (let i = 0; i < prodPaths.length; i += 100) {
              await supabase.storage.from('products').remove(prodPaths.slice(i, i + 100));
            }
          }
        }
      }

      // 1. Delete Transaction Items
      const { error: err1 } = await supabase.from('transaction_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err1) throw new Error(`Gagal hapus item transaksi: ${err1.message}`);

      // 2. Delete Transactions
      const { error: err2 } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err2) throw new Error(`Gagal hapus transaksi: ${err2.message}`);

      if (resetType === 'all') {
        // 3. Delete Product Prices
        const { error: err3 } = await supabase.from('product_prices').delete().neq('product_id', '00000000-0000-0000-0000-000000000000');
        if (err3) throw new Error(`Gagal hapus harga produk: ${err3.message}`);

        // 4. Delete Products
        const { error: err4 } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (err4) throw new Error(`Gagal hapus produk: ${err4.message}`);

        // 5. Delete Users (Kasir only) from Auth and Database
        const { data: kasirsToDelete } = await supabase.from('users').select('id').eq('role', 'kasir');
        if (kasirsToDelete && kasirsToDelete.length > 0) {
          for (const kasir of kasirsToDelete) {
            await fetch('/api/admin/delete-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: kasir.id })
            });
          }
        }

        const { error: err5 } = await supabase.from('users').delete().eq('role', 'kasir');
        if (err5) throw new Error(`Gagal hapus akun kasir: ${err5.message}`);

        // 6. Delete Outlets
        const { error: err6 } = await supabase.from('outlets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (err6) throw new Error(`Gagal hapus outlet: ${err6.message}`);

        toast.success('Seluruh data (transaksi, produk, outlet, dan akun) berhasil direset.');
      } else {
        toast.success('Data transaksi berhasil direset. Akun, produk, dan outlet tetap aman.');
      }
      setTransactionCount(0);
      setLoyaltyCount(0);
      setIsResetModalOpen(false);
      setResetStep(0);
      fetchData();
    } catch (error: any) {
      console.error('Error resetting data:', error);
      toast.error('Gagal mereset data: ' + error.message);
      setResetStep(0);
    } finally {
      setLoading(false);
    }
  };


  const stats = useMemo(() => {
    // Default empty state
    const emptyStats = {
      totalSales: 0,
      totalTransactions: 0,
      regularTransactions: 0,
      loyaltyTransactions: 0,
      genderData: [],
      ageData: [],
      topProducts: [],
      topOutlets: [],
      allOutletData: [],
      chartData: []
    };

    if (!localStats) return emptyStats;

    try {
      const genderData = [
        { name: 'Laki-laki', value: localStats.gender_stats?.['Laki-laki'] || 0 },
        { name: 'Perempuan', value: localStats.gender_stats?.['Perempuan'] || 0 },
      ];

      const ageData = [
        { name: '13–17', value: localStats.age_stats?.['13–17 tahun (Remaja/Teens)'] || 0 },
        { name: '18–24', value: localStats.age_stats?.['18–24 tahun (Dewasa Muda/Gen Z)'] || 0 },
        { name: '25–34', value: localStats.age_stats?.['25–34 tahun (Milenial Muda)'] || 0 },
        { name: '35–44', value: localStats.age_stats?.['35–44 tahun (Milenial Matang/Gen X)'] || 0 },
        { name: '45–54', value: localStats.age_stats?.['45–54 tahun (Gen X)'] || 0 },
        { name: '55+', value: localStats.age_stats?.['55–64 tahun & 65+ (Boomers/Senior)'] || 0 },
      ];

      return {
        totalSales: localStats.total_sales || 0,
        totalTransactions: transactionCount + loyaltyCount,
        regularTransactions: transactionCount,
        loyaltyTransactions: loyaltyCount,
        genderData,
        ageData,
        chartData: localStats.outlet_sales || [],
        topProducts: localStats.top_products || [],
        topOutlets: localStats.outlet_sales || [],
        allOutletData: localStats.all_outlet_sales || []
      };
    } catch (err) {
      console.error('Error calculating stats:', err);
      return emptyStats;
    }
  }, [localStats, transactionCount, loyaltyCount]);

  const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'];
  const PIE_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {viewMode === 'global' ? 'Dashboard Global' : 'Dashboard Outlet'}
          </h2>
          <p className="text-gray-500">Analisis performa penjualan dan demografi customer.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setResetType('transactions');
              setIsResetModalOpen(true);
              setResetStep(1);
            }}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
          >
            <Trash2 className="w-4 h-4" />
            Reset Data
          </button>

          <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex">
            <button
              onClick={() => setViewMode('global')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'global' ? "bg-orange-500 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Globe className="w-4 h-4" />
              Global
            </button>
            <button
              onClick={() => {
                setViewMode('outlet');
                if (!selectedOutletId && outlets.length > 0) setSelectedOutletId(outlets[0].id);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'outlet' ? "bg-orange-500 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Store className="w-4 h-4" />
              Outlet
            </button>
          </div>

          {viewMode === 'outlet' && (
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="bg-white border border-gray-100 px-4 py-2 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
            >
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.nama_outlet}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Limit Reguler"
          value={`${stats.regularTransactions} / 5000`}
          icon={Ticket}
          color="bg-blue-600"
          subValue={stats.regularTransactions >= 4995 ? "Mendekati Limit!" : "Sisa Kuota"}
        />
        <StatCard
          label="Limit Loyalty"
          value={`${stats.loyaltyTransactions} / 100`}
          icon={Trophy}
          color="bg-yellow-500"
          subValue={stats.loyaltyTransactions >= 95 ? "Mendekati Limit!" : "Sisa Kuota"}
        />
        <StatCard
          label="Total Penjualan"
          value={formatRupiah(stats.totalSales)}
          icon={TrendingUp}
          color="bg-orange-500"
        />
        <StatCard
          label="Total Transaksi"
          value={stats.totalTransactions.toString()}
          icon={ShoppingBag}
          color="bg-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 min-w-0">
          <h3 className="text-xl font-bold mb-6">Grafik Klaim Voucher</h3>
          <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-4">Total Voucher yang diklaim per Wilayah/Outlet</p>
          <div className="h-[350px] w-full relative overflow-hidden">
            <div className="absolute inset-0 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} key={`chart-main-${loading}`}>
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: '#fff7ed' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [val.toLocaleString(), 'Voucher']}
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Comparison Chart */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 min-w-0">
          <h3 className="text-xl font-bold mb-6">Penjualan Reguler vs Promo</h3>
          <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-4">Perbandingan Kuantitas Transaksi</p>
          <div className="h-[350px] w-full relative overflow-hidden">
            <div className="absolute inset-0 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={[
                  { name: 'Reguler', value: stats.regularTransactions },
                  { name: 'Promo Milad', value: stats.loyaltyTransactions }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" barSize={60} radius={[12, 12, 0, 0]}>
                    <Cell fill="#f97316" />
                    <Cell fill="#3b82f6" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Demographics Section */}
      <div className="bg-gray-50/50 p-8 md:p-12 rounded-[48px] border border-gray-100">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">Demografi Pelanggan</h3>
            <p className="text-gray-500 font-bold">Mengenal lebih dalam siapa target pasar Anda secara keseluruhan.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h4 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Berdasarkan Gender
            </h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.genderData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 'bold' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ec4899" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h4 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" /> Berdasarkan Kelompok Umur
            </h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ageData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#3b82f6" barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 Outlets (Global Only) */}
      {viewMode === 'global' && (
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Top 10 Outlet Klaim Voucher Terbanyak</h3>
              <p className="text-sm text-gray-500">Outlet dengan jumlah klaim voucher terbanyak di seluruh Indonesia.</p>
            </div>
          </div>

          <div className="h-[400px] w-full relative overflow-hidden">
            <div className="absolute inset-0 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} key={`chart-outlets-${loading}`}>
                <BarChart data={stats.topOutlets} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    width={150}
                  />
                  <Tooltip
                    cursor={{ fill: '#f0f9ff' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [val.toLocaleString(), 'Total Voucher']}
                  />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={24}>
                    {stats.topOutlets.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#1e40af' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Other Outlets Table (Global Only) */}
      {viewMode === 'global' && stats.chartData.length > 10 && (
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Outlet Lainnya (Di luar Top 10)</h3>
              <p className="text-sm text-gray-500">Daftar outlet yang tidak masuk dalam peringkat 10 besar.</p>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari outlet lainnya..."
                  value={rankingSearch}
                  onChange={(e) => {
                    setRankingSearch(e.target.value);
                    setRankingPage(1);
                  }}
                  className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 shadow-sm w-64"
                />
              </div>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 shadow-sm whitespace-nowrap">
                Total {stats.allOutletData.length - 10} Outlet Lainnya
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-20">Rank</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nama Outlet</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Voucher Diklaim</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.allOutletData
                  .map((o, i) => ({ ...o, globalRank: i + 1 }))
                  .slice(10) // Start from 11th
                  .filter(o => o.name.toLowerCase().includes(rankingSearch.toLowerCase()))
                  .slice((rankingPage - 1) * RANKING_PAGE_SIZE, rankingPage * RANKING_PAGE_SIZE)
                  .map((outlet, index) => {
                    const percentage = (outlet.total / stats.totalTransactions) * 100;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-gray-400 bg-gray-50">
                            {outlet.globalRank}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-bold text-gray-900">{outlet.name}</span>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-gray-900">
                          {outlet.total.toLocaleString()}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3 justify-center">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 rounded-full" 
                                style={{ width: `${Math.max(2, percentage)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 w-8">{percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          
          {/* Table Pagination */}
          {stats.allOutletData.slice(10).filter(o => o.name.toLowerCase().includes(rankingSearch.toLowerCase())).length > RANKING_PAGE_SIZE && (
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400">
                Halaman {rankingPage} dari {Math.ceil(stats.allOutletData.slice(10).filter(o => o.name.toLowerCase().includes(rankingSearch.toLowerCase())).length / RANKING_PAGE_SIZE)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRankingPage(p => Math.max(1, p - 1))}
                  disabled={rankingPage === 1}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-orange-500 disabled:opacity-30 transition-all"
                >
                  Prev
                </button>
                <button
                  onClick={() => setRankingPage(p => Math.min(Math.ceil(stats.allOutletData.slice(10).filter(o => o.name.toLowerCase().includes(rankingSearch.toLowerCase())).length / RANKING_PAGE_SIZE), p + 1))}
                  disabled={rankingPage === Math.ceil(stats.allOutletData.slice(10).filter(o => o.name.toLowerCase().includes(rankingSearch.toLowerCase())).length / RANKING_PAGE_SIZE)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-orange-500 disabled:opacity-30 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Products Section */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Produk Terlaris (Qty)</h3>
            <p className="text-sm text-gray-500">Produk yang paling banyak dibeli oleh customer.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.topProducts.map((product, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-orange-500 shadow-sm border border-gray-100">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{product.nama}</h4>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-gray-500">{product.qty} Terjual</span>
                  <span className="text-sm font-bold text-orange-600">{formatRupiah(product.total)}</span>
                </div>
              </div>
            </div>
          ))}
          {stats.topProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400">
              Belum ada data penjualan produk.
            </div>
          )}
        </div>
      </div>

      {/* Reset Data Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-8 mx-auto">
              <Trash2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-center mb-4">
              {resetStep === 1 ? (resetType === 'all' ? 'Reset Keseluruhan?' : 'Reset Data Penjualan?') : resetStep === 2 ? 'Konfirmasi Terakhir' : 'Sedang Mereset...'}
            </h3>

            <p className="text-gray-500 text-center mb-10 leading-relaxed">
              {resetStep === 1
                ? (resetType === 'all'
                  ? 'Tindakan ini akan menghapus SELURUH data: transaksi, produk, outlet, dan akun kasir secara permanen.'
                  : 'Tindakan ini akan menghapus seluruh riwayat transaksi dan grafik laporan. Akun kasir, data produk, dan outlet akan TETAP AMAN.')
                : resetStep === 2
                  ? 'Apakah Anda benar-benar yakin? Data yang sudah dihapus tidak dapat dikembalikan.'
                  : 'Mohon tunggu, sistem sedang membersihkan data...'}
            </p>

            <div className="flex flex-col gap-4">
              {resetStep === 1 && (
                <>
                  {resetType === 'transactions' ? (
                    <button
                      onClick={() => setResetType('all')}
                      className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition-all text-xs"
                    >
                      Beralih ke Reset Keseluruhan?
                    </button>
                  ) : (
                    <button
                      onClick={() => setResetType('transactions')}
                      className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-blue-50 hover:text-blue-600 transition-all text-xs"
                    >
                      Beralih ke Reset Transaksi Saja?
                    </button>
                  )}

                  <button
                    onClick={() => setResetStep(2)}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-xl shadow-red-100 transition-all active:scale-95"
                  >
                    LANJUTKAN
                  </button>
                  <button
                    onClick={() => setIsResetModalOpen(false)}
                    className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Batal
                  </button>
                </>
              )}

              {resetStep === 2 && (
                <>
                  <button
                    onClick={handleResetData}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-xl shadow-red-100 transition-all active:scale-95"
                  >
                    YA, RESET {resetType === 'all' ? 'SEMUA DATA' : 'TRANSAKSI'}
                  </button>
                  <button
                    onClick={() => setResetStep(1)}
                    className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Kembali
                  </button>
                </>
              )}

              {resetStep === 3 && (
                <div className="flex justify-center py-4">
                  <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, subValue }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
        <Icon className="w-7 h-7" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
        {subValue && (
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-wider mt-1",
            subValue.includes('Limit') ? "text-red-500" : "text-gray-400"
          )}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
}
