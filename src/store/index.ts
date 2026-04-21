import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, CartItem, Product, Transaction, Outlet, ProductPrice } from '../types';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  loading: true,
  setLoading: (loading) => set({ loading }),
}));

interface CartState {
  items: CartItem[];
  addItem: (product: Product, harga: number, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  calculateTotal: () => void;
  total: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  receiptPreview: string | null;
  setReceiptPreview: (preview: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isCartOpen: false,
      setIsCartOpen: (isCartOpen) => set({ isCartOpen }),
      receiptPreview: null,
      setReceiptPreview: (receiptPreview) => set({ receiptPreview }),
      addItem: (product, harga, qty = 1) => {
        const items = get().items;
        const existing = items.find((i) => i.id === product.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === product.id ? { ...i, qty: i.qty + qty } : i
            ),
          });
        } else {
          set({ items: [...items, { ...product, qty, harga_default: harga }] });
        }
        get().calculateTotal();
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.id !== productId) });
        get().calculateTotal();
      },
      updateQty: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.id === productId ? { ...i, qty } : i
          ),
        });
        get().calculateTotal();
      },
      clearCart: () => set({ items: [], total: 0 }),
      total: 0,
      calculateTotal: () => {
        const total = get().items.reduce((acc, item) => acc + (item.harga_default || 0) * item.qty, 0);
        set({ total });
      },
    }),
    {
      name: 'dmc-pos-storage-v3', // New unique name to force clean slate
      version: 3,
    }
  )
);

interface AppState {
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  transactionCount: number;
  setTransactionCount: (count: number) => void;
  loyaltyCount: number;
  setLoyaltyCount: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  logoUrl: null,
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  transactionCount: 0,
  setTransactionCount: (transactionCount) => set({ transactionCount }),
  loyaltyCount: 0,
  setLoyaltyCount: (loyaltyCount) => set({ loyaltyCount }),
}));

import { DUMMY_TRANSACTIONS, DUMMY_PRODUCTS, DUMMY_OUTLETS, DUMMY_PRODUCT_PRICES } from '../lib/dummyData';

interface DemoState {
  transactions: Transaction[];
  products: Product[];
  outlets: Outlet[];
  kasirs: User[];
  productPrices: ProductPrice[];
  addTransaction: (transaction: Transaction) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setProducts: (products: Product[]) => void;
  setOutlets: (outlets: Outlet[]) => void;
  setKasirs: (kasirs: User[]) => void;
  setProductPrices: (prices: ProductPrice[]) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  transactions: [],
  products: [],
  outlets: [],
  kasirs: [],
  productPrices: [],
  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions]
  })),
  setTransactions: (transactions) => set({ transactions }),
  setProducts: (products) => set({ products }),
  setOutlets: (outlets) => set({ outlets }),
  setKasirs: (kasirs) => set({ kasirs }),
  setProductPrices: (productPrices) => set({ productPrices }),
}));
