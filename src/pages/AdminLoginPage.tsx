import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  React.useEffect(() => {
    const saved = localStorage.getItem('dmc_admin_remember_me');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
        if (parsed.rememberMe !== undefined) setRememberMe(parsed.rememberMe);
      } catch (e) {
        console.error('Error parsing remembered credentials', e);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email atau password salah');
        }
        throw error;
      }
      
      if (data.user) {
        // Fetch profile to check role
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile && profile.role === 'admin') {
          if (rememberMe) {
            localStorage.setItem('dmc_admin_remember_me', JSON.stringify({ email, password, rememberMe }));
          } else {
            localStorage.removeItem('dmc_admin_remember_me');
          }
          setUser(profile);
          toast.success('Selamat datang Admin Pusat!');
          navigate('/rzpanel');
        } else {
          await supabase.auth.signOut();
          throw new Error('Akses ditolak. Halaman ini hanya untuk Admin Pusat.');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gray-800 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          </div>
          <img 
            src="https://donatmaduindonesia.com/wp-content/uploads/2025/08/Logo-Website.svg" 
            alt="Logo" 
            className="h-16 w-auto mx-auto mb-4 relative z-10" 
          />
          <p className="text-gray-400 text-sm font-medium">Panel Manajemen Donat Madu Cihanjuang</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Email Admin</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-gray-800 focus:border-transparent outline-none transition-all"
                  placeholder="admin@dmc.id"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-gray-800 focus:border-transparent outline-none transition-all"
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

            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2 cursor-pointer group outline-none"
              >
                <div className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                  rememberMe ? "bg-gray-800 border-gray-800" : "border-gray-300 group-hover:border-gray-700"
                )}>
                  {rememberMe && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
                <span className="text-sm font-bold text-gray-600">Ingat Saya</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-black py-5 rounded-3xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'Masuk Panel Admin'
              )}
            </button>
            
            <div className="text-center text-[10px] text-gray-300 mt-8 font-medium tracking-widest uppercase">
              &copy; 2026 Donat Madu Cihanjuang
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
