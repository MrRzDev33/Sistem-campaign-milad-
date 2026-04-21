import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App.tsx';
import './index.css';

import { BrowserRouter } from 'react-router-dom';

class ErrorBoundary extends Component<{children: ReactNode}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Waduh, ada kendala sistem!</h2>
          <p className="text-gray-600 mb-8">Aplikasi gagal dimuat karena sisa data lama yang bentrok di browser Anda.</p>
          <button 
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/';
            }}
            className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg"
          >
            Bersihkan Data & Muat Ulang
          </button>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

// Re-enabled Service Worker Kill Switch to fix Blank Screen and Cache issues
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW Kill Switch registered');
      // If there's a waiting worker, force it to skip waiting
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }).catch(err => console.log('SW registration failed: ', err));
  }
);
}
