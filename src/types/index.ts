export type Role = 'admin' | 'kasir';
export type Gender = 'Laki-laki' | 'Perempuan' | '';
export type AgeRange = 
  | '13–17 tahun (Remaja/Teens)'
  | '18–24 tahun (Dewasa Muda/Gen Z)'
  | '25–34 tahun (Milenial Muda)'
  | '35–44 tahun (Milenial Matang/Gen X)'
  | '45–54 tahun (Gen X)'
  | '55–64 tahun & 65+ (Boomers/Senior)'
  | '';

export interface User {
  id: string;
  email: string;
  username?: string;
  password?: string;
  role: Role;
  outlet_id?: string;
  phone?: string;
  address?: string;
  created_at?: string;
  outlet?: Outlet;
}

export interface MasterOutlet {
  id: string;
  nama: string;
  created_at: string;
}

export interface Outlet {
  id: string;
  nama_outlet: string;
  alamat: string;
  provinsi: string;
  created_at: string;
  phone?: string;
}

export interface Product {
  id: string;
  nama: string;
  harga_default: number;
  gambar_url: string;
  created_at: string;
  is_loyalty?: boolean;
}

export interface ProductPrice {
  product_id: string;
  outlet_id: string;
  harga: number;
}

export interface Transaction {
  id: string;
  outlet_id: string;
  user_id: string;
  total: number;
  customer_gender: Gender;
  customer_age_range: AgeRange;
  receipt_url: string;
  created_at: string;
  promo_type?: 'regular' | 'loyalty_7mei';
  outlet?: Outlet;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  qty: number;
  harga: number;
  product?: Product;
}

export interface CartItem extends Product {
  qty: number;
}
