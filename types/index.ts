export interface User {
  id: string;
  username: string;
  email?: string;
  full_name: string;
  role: 'admin' | 'designer' | 'marketing' | 'dispatch';
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone: string;
  gstin?: string;
  address?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  description: string;
  amount: number;
  status: 'pending' | 'design' | 'production' | 'qc' | 'ready' | 'dispatched' | 'delivered';
  created_at: string;
}
