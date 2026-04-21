import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url.includes('supabase.co');
  } catch {
    return false;
  }
};

/**
 * Initialize Supabase client safely.
 * If credentials are missing or invalid, we provide a mock client that returns empty results
 * to prevent the app from crashing in demo mode.
 */
const createMockProxy = (): any => {
  const proxy: any = new Proxy(() => proxy, {
    get(target, prop) {
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: () => Promise.resolve({ error: null }),
          signUp: () => Promise.resolve({ data: { user: null }, error: null }),
          signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
        };
      }
      if (prop === 'storage') {
        return {
          from: () => ({
            upload: () => Promise.resolve({ data: { path: 'mock' }, error: null }),
            getPublicUrl: () => ({ data: { publicUrl: 'https://picsum.photos/200' } }),
            remove: () => Promise.resolve({ error: null }),
          })
        };
      }
      if (prop === 'from') {
        return () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              order: () => Promise.resolve({ data: [], error: null }),
              limit: () => Promise.resolve({ data: [], error: null }),
              gte: () => ({
                lte: () => ({
                  order: () => Promise.resolve({ data: [], error: null })
                })
              })
            }),
            order: () => Promise.resolve({ data: [], error: null }),
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          insert: () => Promise.resolve({ data: [], error: null }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
          upsert: () => Promise.resolve({ data: null, error: null }),
          delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        });
      }
      return proxy;
    }
  });
  return proxy;
};

const mockClient = createMockProxy();

export const supabase: SupabaseClient = (supabaseUrl && isValidUrl(supabaseUrl) && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (() => {
      console.warn('Supabase credentials missing or invalid. Using mock client. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
      return mockClient as unknown as SupabaseClient;
    })();
