import React, { useEffect, useState } from 'react';
import { useAuthStore, useAppStore } from './store';
import { supabase } from './lib/supabase';
import { Toaster, toast } from 'sonner';
import { LogOut, LayoutDashboard, ShoppingCart, Package, Store, FileText, Menu, X } from 'lucide-react';
import { cn } from './lib/utils';

// Pages
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import RegisterKasirPage from './pages/RegisterKasirPage';
import Dashboard from './pages/admin/Dashboard';
import ProductManagement from './pages/admin/ProductManagement';
import OutletManagement from './pages/admin/OutletManagement';
import MasterOutletManagement from './pages/admin/MasterOutlet';
import Reports from './pages/admin/Reports';
import KasirPage from './pages/kasir/KasirPage';

import { RefreshCw, List } from 'lucide-react';

import { useLocation, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';

export default function App() {
  const { user, setUser, loading, setLoading } = useAuthStore();
  const { logoUrl, setLogoUrl, setTransactionCount, setLoyaltyCount } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleHardReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    // Clear cookies too if possible
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.reload();
  };

  const fetchTransactionCount = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_quotas');
      
      if (error) throw error;
      
      if (data) {
        setTransactionCount(data.regular || 0);
        setLoyaltyCount(data.loyalty || 0);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || (typeof event.reason === 'string' ? event.reason : '');
      
      // Ignore benign Vite/WebSocket errors
      if (message.includes('WebSocket') || message.includes('vite')) {
        event.preventDefault();
        return;
      }

      if (message.includes('Failed to fetch')) {
        toast.error('Koneksi terputus atau diblokir. Harap cek internet atau matikan AdBlocker.', {
          id: 'fetch-error',
          duration: 5000
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Listen for auth changes
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error?.message?.includes('Refresh Token Not Found') || error?.message?.includes('invalid refresh token')) {
        console.warn('Initial session refresh failed:', error.message);
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      
      // Handle session errors or involuntary sign-outs
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        const checkSession = async () => {
          const { error } = await supabase.auth.getSession();
          if (error?.message?.includes('Refresh Token Not Found') || error?.message?.includes('invalid refresh token')) {
            console.warn('Refresh token invalid, clearing session...');
            setUser(null);
            setLoading(false);
            // Optional: toast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          }
        };
        checkSession();
      }

      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Fetch logo
    supabase.from('settings').select('value').eq('key', 'logo_url').single()
      .then(({ data }) => {
        if (data) setLogoUrl(data.value);
      });

    // Initial count
    fetchTransactionCount();

    // Real-time transaction count
    const channel = supabase
      .channel('transaction-count-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          fetchTransactionCount();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserProfile = async (userId: string, retryCount = 0) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Only show loading screen if user data hasn't been loaded yet
    if (!useAuthStore.getState().user) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, outlet:outlets(*)')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        console.log('User profile fetched:', data);
        setUser(data);
        setLoading(false);
      } else if (retryCount < 5) {
        // Retry if profile not found yet (might be still inserting)
        setTimeout(() => fetchUserProfile(userId, retryCount + 1), 1000);
      } else {
        console.warn('Profil tidak ditemukan setelah 5x percobaan.');
        toast.error('Profil pengguna tidak ditemukan. Harap hubungi admin.');
        setUser(null);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (retryCount < 5) {
        setTimeout(() => fetchUserProfile(userId, retryCount + 1), 1000);
      } else {
        toast.error('Gagal memuat profil: ' + (error.message || 'Error tidak diketahui'));
        setUser(null);
        setLoading(false);
      }
    }
  };

  const handleLogout = async (redirectPath: string = '/login') => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
      // Clear localStorage just in case to fix stuck refresh token errors
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('supabase.auth.token') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      toast.success('Berhasil keluar');
      navigate(redirectPath);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
        <p className="text-orange-600 font-medium animate-pulse">Memuat Sistem...</p>
        <div className="mt-10 text-center space-y-4">
          <p className="text-xs text-gray-400">Proses ini memakan waktu lebih lama dari biasanya?</p>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleLogout()}
              className="text-orange-600 text-sm font-bold hover:underline"
            >
              Paksa Keluar & Login Ulang
            </button>
            <button 
              onClick={handleHardReset}
              className="text-red-500 text-[10px] font-medium hover:underline opacity-50 hover:opacity-100 transition-opacity"
            >
              Hapus Cache & Reset Total Sistem
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register-kasir" element={<RegisterKasirPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/rzpanel/login" element={<AdminLoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/rzpanel/login" element={<Navigate to="/rzpanel" replace />} />
      <Route path="/register-kasir" element={<Navigate to="/" replace />} />
      
      <Route path="/rzpanel/*" element={
        user.role === 'admin' ? (
          <AdminLayout 
            user={user} 
            logoUrl={logoUrl} 
            handleLogout={handleLogout} 
            setUser={setUser}
            navigate={navigate}
          />
        ) : (
          <Navigate to="/" replace />
        )
      } />

      <Route path="/" element={
        user.role === 'kasir' ? (
          <KasirPage />
        ) : (
          <Navigate to="/rzpanel" replace />
        )
      } />
      
      <Route path="*" element={<Navigate to={user.role === 'admin' ? '/rzpanel' : '/'} replace />} />
    </Routes>
  );
}

function AdminLayout({ user, logoUrl, handleLogout, setUser, navigate }: any) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/rzpanel' },
    { id: 'products', label: 'Produk', icon: Package, path: '/rzpanel/products' },
    { id: 'master-outlets', label: 'Master Outlet', icon: List, path: '/rzpanel/master-outlets' },
    { id: 'outlets', label: 'Outlet Terdaftar', icon: Store, path: '/rzpanel/outlets' },
    { id: 'reports', label: 'Laporan', icon: FileText, path: '/rzpanel/reports' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img 
            src="https://donatmaduindonesia.com/wp-content/uploads/2025/08/Logo-Website.svg" 
            alt="Logo" 
            className="h-6 w-auto" 
          />
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 hidden md:block">
            <img 
              src="https://donatmaduindonesia.com/wp-content/uploads/2025/08/Logo-Website.svg" 
              alt="Logo" 
              className="h-10 w-auto mx-auto" 
            />
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
                    : "text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{user.phone || user.email}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
            <button
              onClick={() => {
                handleLogout('/rzpanel/login');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductManagement />} />
          <Route path="/master-outlets" element={<MasterOutletManagement />} />
          <Route path="/outlets" element={<OutletManagement />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </main>
    </div>
  );
}
