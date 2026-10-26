import { format } from 'date-fns';

export interface User {
  id: number;
  username: string;
  full_name: string;
  address: string;
  phone: string;
  package_name: string;
  price: number;
  status: 'active' | 'inactive';
  expiry_date: string;
  role: 'admin' | 'customer';
  created_at: string;
}

export interface Invoice {
  id: number;
  user_id: number;
  user_name?: string;
  amount: number;
  month: string;
  status: 'paid' | 'unpaid';
  payment_method?: string;
  transaction_id?: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  user_id: number;
  user_name?: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  created_at: string;
}

export interface Stats {
  totalUsers: number;
  activeUsers: number;
  dueBills: number;
  monthlyRevenue: number;
}

export interface Package {
  id: number;
  name: string;
  price: number;
  local_address: string;
  remote_address: string;
  rate_limit: string;
  created_at: string;
}
