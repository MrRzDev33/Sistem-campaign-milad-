import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, cn } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, Users, Store, ShoppingBag, Trophy, Globe, MapPin, Ticket, Trash2 } from 'lucide-react';
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

  const [viewMode, setViewMode] = useState<'global' | 'province' | 'outlet'>('global');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState(0); // 0: Idle, 1: First confirm, 2: Final confirm, 3: Processing
  
  useEffect(() => {
    fetchData();

    // Listen for new transactions
    const channel = supabase
      .channel('public:transactions')
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*, items:transaction_items(*, product:products(*)), outlet:outlets(*)');
      
      if (transactionsError) throw transactionsError;

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*');
      
      if (productsError) throw productsError;

      const { data: outletsData, error: outletsError } = await supabase
        .from('outlets')
        .select('*');
      
      if (outletsError) throw outletsError;

      const finalTransactions = transactionsData || [];
      const finalProducts = productsData || [];
      const finalOutlets = outletsData || [];

      setTransactions(finalTransactions);
      setProducts(finalProducts);
      setOutlets(finalOutlets);

      // Sync with store for other components
      setDemoTransactions(finalTransactions);
      setDemoProducts(finalProducts);
      setDemoOutlets(finalOutlets);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setTransactions([]);
      setProducts([]);
      setOutlets([]);
      setDemoTransactions([]);
      setDemoProducts([]);
      setDemoOutlets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    setResetStep(3);
    setLoading(true);
    try {
      // 1. Delete Transaction Items
      const { error: err1 } = await supabase.from('transaction_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err1) throw new Error(`Gagal hapus item transaksi: ${err1.message}`);

      // 2. Delete Transactions
      const { error: err2 } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err2) throw new Error(`Gagal hapus transaksi: ${err2.message}`);

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

      toast.success('Semua data berhasil direset. Silakan mulai dari awal.');
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

  const provinces = useMemo(() => {
    const p = new Set(outlets.map(o => o.provinsi));
    return Array.from(p);
  }, [outlets]);

  const filteredTransactions = useMemo(() => {
    if (viewMode === 'global') return transactions;
    if (viewMode === 'province') {
      const provinceOutlets = outlets.filter(o => o.provinsi === selectedProvince).map(o => o.id);
      return transactions.filter(t => provinceOutlets.includes(t.outlet_id));
    }
    return transactions.filter(t => t.outlet_id === selectedOutletId);
  }, [transactions, viewMode, selectedProvince, selectedOutletId, outlets]);

  const stats = useMemo(() => {
    const totalSales = filteredTransactions.reduce((acc, t) => acc + t.total, 0);
    const totalTransactions = filteredTransactions.length;
    const regularTransactions = filteredTransactions.filter(t => t.promo_type === 'regular' || !t.promo_type).length;
    const loyaltyTransactions = filteredTransactions.filter(t => t.promo_type === 'loyalty_7mei').length;
    
    // Demography Data
    const genderData = [
      { name: 'Laki-laki', value: filteredTransactions.filter(t => t.customer_gender === 'Laki-laki').length },
      { name: 'Perempuan', value: filteredTransactions.filter(t => t.customer_gender === 'Perempuan').length },
    ];

    const ageData = [
      { name: '13–17', value: filteredTransactions.filter(t => t.customer_age_range === '13–17 tahun (Remaja/Teens)').length },
      { name: '18–24', value: filteredTransactions.filter(t => t.customer_age_range === '18–24 tahun (Dewasa Muda/Gen Z)').length },
      { name: '25–34', value: filteredTransactions.filter(t => t.customer_age_range === '25–34 tahun (Milenial Muda)').length },
      { name: '35–44', value: filteredTransactions.filter(t => t.customer_age_range === '35–44 tahun (Milenial Matang/Gen X)').length },
      { name: '45–54', value: filteredTransactions.filter(t => t.customer_age_range === '45–54 tahun (Gen X)').length },
      { name: '55+', value: filteredTransactions.filter(t => t.customer_age_range === '55–64 tahun & 65+ (Boomers/Senior)').length },
    ];

    // Sales per Outlet/Province
    const salesMap: Record<string, number> = {};
    filteredTransactions.forEach((t: any) => {
      const outlet = outlets.find(o => o.id === t.outlet_id);
      const name = viewMode === 'global' ? outlet?.provinsi : outlet?.nama_outlet;
      if (name) salesMap[name] = (salesMap[name] || 0) + t.total;
    });

    const chartData = Object.entries(salesMap).map(([name, total]) => ({
      name,
      total
    })).sort((a, b) => b.total - a.total);

    // Top Products Calculation
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

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Top 10 Outlets by Sales (Global only)
    const outletSales: Record<string, { name: string, total: number }> = {};
    transactions.forEach(t => {
      const outlet = outlets.find(o => o.id === t.outlet_id);
      if (outlet) {
        if (!outletSales[outlet.id]) {
          outletSales[outlet.id] = { name: outlet.nama_outlet, total: 0 };
        }
        outletSales[outlet.id].total += t.total;
      }
    });

    const topOutlets = Object.values(outletSales)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Promo Specific Demographics
    const promoTransactions = filteredTransactions.filter(t => t.promo_type === 'loyalty_7mei');
    const promoGenderData = [
      { name: 'Laki-laki', value: promoTransactions.filter(t => t.customer_gender === 'Laki-laki').length },
      { name: 'Perempuan', value: promoTransactions.filter(t => t.customer_gender === 'Perempuan').length },
    ];
    const promoAgeData = [
      { name: '13–17', value: promoTransactions.filter(t => t.customer_age_range === '13–17 tahun (Remaja/Teens)').length },
      { name: '18–24', value: promoTransactions.filter(t => t.customer_age_range === '18–24 tahun (Dewasa Muda/Gen Z)').length },
      { name: '25–34', value: promoTransactions.filter(t => t.customer_age_range === '25–34 tahun (Milenial Muda)').length },
      { name: '35–44', value: promoTransactions.filter(t => t.customer_age_range === '35–44 tahun (Milenial Matang/Gen X)').length },
      { name: '45–54', value: promoTransactions.filter(t => t.customer_age_range === '45–54 tahun (Gen X)').length },
      { name: '55+', value: promoTransactions.filter(t => t.customer_age_range === '55–64 tahun & 65+ (Boomers/Senior)').length },
    ];

    return {
      totalSales,
      totalTransactions,
      regularTransactions,
      loyaltyTransactions,
      genderData,
      ageData,
      promoGenderData,
      promoAgeData,
      chartData,
      topProducts,
      topOutlets
    };
  }, [filteredTransactions, transactions, viewMode, outlets]);

  const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'];
  const PIE_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {viewMode === 'global' ? 'Dashboard Global' : viewMode === 'province' ? 'Dashboard Provinsi' : 'Dashboard Outlet'}
          </h2>
          <p className="text-gray-500">Analisis performa penjualan dan demografi customer.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setIsResetModalOpen(true);
              setResetStep(1);
            }}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
          >
            <Trash2 className="w-4 h-4" />
            Reset Semua Data
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
                setViewMode('province');
                if (!selectedProvince && provinces.length > 0) setSelectedProvince(provinces[0]);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'province' ? "bg-orange-500 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <MapPin className="w-4 h-4" />
              Provinsi
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

          {viewMode === 'province' && (
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="bg-white border border-gray-100 px-4 py-2 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
            >
              {provinces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

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
          <h3 className="text-xl font-bold mb-6">Grafik Penjualan</h3>
          <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-4">Total Penjualan per Wilayah/Outlet</p>
          <div className="h-[350px] w-full relative overflow-hidden">
            <div className="absolute inset-0 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} key={`chart-main-${loading}`}>
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(val) => `Rp ${val/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: '#fff7ed' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [formatRupiah(val), 'Penjualan']}
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

      {/* Special Promo Analytics Section */}
      <div className="bg-blue-50/50 p-8 md:p-12 rounded-[48px] border border-blue-100">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-blue-900 tracking-tight">Analisis Khusus Promo Milad</h3>
            <p className="text-blue-600/70 font-bold">Mengenal lebih dalam siapa pengguna promo Anda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-blue-50">
            <h4 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Gender (Khusus Promo)
            </h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.promoGenderData} layout="vertical">
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

          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-blue-50">
            <h4 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" /> Kelompok Umur (Khusus Promo)
            </h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.promoAgeData}>
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
              <h3 className="text-xl font-bold">Top 10 Outlet Penjualan Tertinggi</h3>
              <p className="text-sm text-gray-500">Outlet dengan performa penjualan terbaik di seluruh Indonesia.</p>
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
                    formatter={(val: number) => [formatRupiah(val), 'Total Penjualan']}
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
              {resetStep === 1 ? 'Hapus Semua Data?' : resetStep === 2 ? 'Konfirmasi Terakhir' : 'Sedang Mereset...'}
            </h3>
            
            <p className="text-gray-500 text-center mb-10 leading-relaxed">
              {resetStep === 1 
                ? 'Tindakan ini akan menghapus seluruh data transaksi, produk, outlet, dan akun kasir secara permanen.' 
                : resetStep === 2 
                ? 'Apakah Anda benar-benar yakin? Data yang sudah dihapus tidak dapat dikembalikan lagi.' 
                : 'Mohon tunggu, sistem sedang membersihkan database...'}
            </p>

            <div className="flex flex-col gap-4">
              {resetStep === 1 && (
                <>
                  <button
                    onClick={() => setResetStep(2)}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-xl shadow-red-100 transition-all active:scale-95"
                  >
                    Ya, Lanjutkan
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
                    SAYA YAKIN, HAPUS SEMUA
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
