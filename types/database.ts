// =============================================
// AAYAM OFFICE - DATABASE TYPES
// =============================================

// Enums
export type UserRole = 'admin' | 'manager' | 'sales' | 'designer' | 'dispatch' | 'marketing' | 'finance';
export type JobStatus = 'new' | 'designing' | 'approval' | 'printing' | 'finishing' | 'quality_check' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'rework' | 'completed';
export type ProjectStatus = 'planning' | 'in_progress' | 'review' | 'on_hold' | 'completed';
export type PaymentMode = 'cash' | 'bank_transfer' | 'neft' | 'rtgs' | 'upi' | 'cheque' | 'card';
export type LeadStatus = 'new' | 'contacted' | 'quotation_shared' | 'follow_up' | 'converted' | 'lost';
export type LeadSource = 'website' | 'referral' | 'walk_in' | 'social_media' | 'advertisement' | 'cold_call' | 'other' | 'facebook' | 'instagram' | 'indiamart';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
export type DispatchStatus = 'pending' | 'packed' | 'dispatched' | 'in_transit' | 'delivered' | 'returned';

// Base type with common fields
interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// User Profile
export interface Profile extends BaseEntity {
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  commission_rate?: number;
}

// Company Settings
export interface CompanySettings extends BaseEntity {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
  pan?: string;
  logo_url?: string;
  invoice_prefix: string;
  invoice_start_number: number;
  current_financial_year?: string;
}

// Lead
export interface Lead extends BaseEntity {
  lead_number: string;

  name: string;
  company?: string;
  email?: string;
  phone: string;

  source: LeadSource;
  status: LeadStatus;

  // New fields for Marketing Workflow
  lead_type?: 'printing_only' | 'designing_only' | 'design_printing';
  billing_preference?: 'gst' | 'non_gst' | 'both';
  lost_reason?: string;

  requirement?: string;
  expected_value: number;

  assigned_to?: string;

  next_follow_up?: string;
  last_contacted?: string;

  notes?: string;

  converted_to_client_id?: string;

  created_by?: string;

  // Joined data
  assigned_user?: Profile;
  follow_ups?: FollowUp[];
}

// Client
export interface Client extends BaseEntity {
  name: string;
  company?: string;
  email?: string;
  phone: string;
  alt_phone?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  client_type: 'regular' | 'premium' | 'corporate';
  credit_limit: number;
  outstanding_balance: number;
  notes?: string;
  is_active: boolean;
  created_by?: string;
}

// Vendor
export interface Vendor extends BaseEntity {
  name: string;
  company?: string;
  email?: string;
  phone: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  category?: string;
  payment_terms: number;
  outstanding_balance: number;
  is_active: boolean;
}

// Designer
export interface Designer extends BaseEntity {
  user_id?: string;
  name: string;
  email?: string;
  phone: string;
  skills: string[];
  employment_type: 'full-time' | 'part-time' | 'freelance';
  hourly_rate: number;
  monthly_salary: number;
  joining_date?: string;
  city?: string;
  state?: string;
  is_active: boolean;
}

// Designer Hours
export interface DesignerHours {
  id: string;
  designer_id: string;
  date: string;
  hours_worked: number;
  overtime_hours: number;
  is_leave: boolean;
  leave_type?: 'paid' | 'unpaid' | 'sick' | 'casual';
  notes?: string;
  created_at: string;
}

// Job/Order
export interface Job extends BaseEntity {
  job_number: string;
  project_name: string;
  client_id?: string;
  vendor_id?: string;
  designer_id?: string;

  job_type?: string;
  description?: string;
  quantity: number;

  quote_per_piece: number;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;

  payment_status: PaymentStatus;
  amount_received: number;

  order_date: string;
  client_deadline?: string;
  internal_deadline?: string;
  completed_date?: string;

  current_stage: JobStatus;
  priority: PriorityLevel;

  files: FileAttachment[];
  notes?: string;
  created_by?: string;
  sales_person_id?: string;

  // Joined data
  client?: Client;
  vendor?: Vendor;
  designer?: Designer;
  sales_person?: Profile;
  invoices?: Invoice[];
}

// File Attachment
export interface FileAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

// Design Task
export interface DesignTask extends BaseEntity {
  task_number: string;
  title: string;
  description?: string;

  job_id?: string;
  client_id?: string;
  assigned_to?: string;

  status: TaskStatus;
  priority: PriorityLevel;

  start_date?: string;
  deadline?: string;
  completed_date?: string;
  estimated_hours: number;
  actual_hours: number;

  attachments: FileAttachment[];
  drive_link?: string;

  created_by?: string;

  // Joined data
  job?: Job;
  client?: Client;
  designer?: Designer;
  remarks?: TaskRemark[];
}

// Task Remark
export interface TaskRemark {
  id: string;
  task_id: string;
  user_id: string;
  remark: string;
  created_at: string;
  user?: Profile;
}

// Design Project
export interface DesignProject extends BaseEntity {
  project_number: string;
  name: string;
  description?: string;

  client_id?: string;
  team_members: string[];

  status: ProjectStatus;
  progress: number;

  start_date?: string;
  end_date?: string;

  drive_link?: string;

  created_by?: string;

  // Joined data
  client?: Client;
  tasks?: DesignTask[];
}

// Invoice
export interface Invoice extends BaseEntity {
  invoice_number: string;

  client_id?: string;
  job_id?: string;

  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  discount_amount: number;
  total_amount: number;

  payment_status: PaymentStatus;
  amount_paid: number;
  balance_due: number;

  invoice_date: string;
  due_date?: string;

  notes?: string;
  terms?: string;

  created_by?: string;

  // Joined data
  client?: Client;
  job?: Job;
  items?: InvoiceItem[];
}

// Invoice Item
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  hsn_code?: string;
  gst_rate: number;
}

// Payment Received
export interface PaymentReceived extends BaseEntity {
  payment_number: string;

  client_id?: string;
  invoice_id?: string;
  job_id?: string;

  amount: number;
  payment_mode: PaymentMode;
  payment_date: string;

  bank_account_id?: string;
  reference_number?: string;

  notes?: string;

  received_by?: string;
  attachment_url?: string;

  // Joined data
  client?: Client;
  bank_account?: BankAccount;
}

// Purchase Bill
export interface PurchaseBill extends BaseEntity {
  bill_number: string;
  vendor_bill_number?: string;

  vendor_id?: string;
  job_id?: string;

  product_type?: string;
  description?: string;
  quantity: number;
  rate: number;

  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;

  payment_status: PaymentStatus;
  amount_paid: number;

  bill_date: string;
  due_date?: string;

  created_by?: string;

  // Joined data
  vendor?: Vendor;
  job?: Job;
}

// Vendor Payment
export interface VendorPayment extends BaseEntity {
  payment_number: string;

  vendor_id?: string;
  purchase_bill_id?: string;

  amount: number;
  payment_mode: PaymentMode;
  payment_date: string;

  bank_account_id?: string;
  reference_number?: string;

  notes?: string;

  paid_by?: string;
  attachment_url?: string;

  // Joined data
  vendor?: Vendor;
  bank_account?: BankAccount;
}

// Bank Account
export interface BankAccount extends BaseEntity {
  name: string;
  account_number: string;
  ifsc_code?: string;
  branch?: string;
  account_type: 'current' | 'savings' | 'od' | 'cc';

  opening_balance: number;
  current_balance: number;

  is_default: boolean;
  is_active: boolean;
}

// Bank Transaction
export interface BankTransaction {
  id: string;
  bank_account_id: string;

  transaction_type: 'inflow' | 'outflow';
  amount: number;

  reference_type?: string | null;
  reference_id?: string;

  description?: string;
  reference_number?: string;
  transaction_date: string;

  balance_after: number;

  created_by?: string;
  created_at: string;
}

// Opening Balance
export interface OpeningBalance extends BaseEntity {
  financial_year: string;
  as_of_date: string;
  cash_balance: number;
  is_locked: boolean;
  created_by?: string;
}

// Expense
export interface Expense extends BaseEntity {
  expense_number: string;
  category: string;
  description?: string;
  amount: number;
  payment_mode?: PaymentMode;
  bank_account_id?: string;
  expense_date: string;
  receipt_url?: string;
  created_by?: string;
}



// Follow Up
export interface FollowUp {
  id: string;
  lead_id: string;

  follow_up_date: string;
  follow_up_type?: string;

  notes?: string;
  outcome?: string;

  next_follow_up?: string;

  done_by?: string;
  created_at: string;

  user?: Profile;
}

// Quotation
export interface Quotation extends BaseEntity {
  quote_number: string;

  client_id?: string;
  lead_id?: string;

  status: QuoteStatus;

  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;

  valid_until?: string;

  terms?: string;
  notes?: string;

  converted_to_job_id?: string;

  created_by?: string;

  // Joined data
  client?: Client;
  items?: QuotationItem[];
}

// Quotation Item
export interface QuotationItem {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  gst_rate: number;
}

// Dispatch
export interface Dispatch extends BaseEntity {
  dispatch_number: string;

  job_id?: string;
  client_id?: string;

  status: DispatchStatus;

  transporter_name?: string;
  tracking_number?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;

  dispatch_date?: string;
  expected_delivery?: string;
  actual_delivery?: string;

  packages: number;
  weight?: number;

  delivery_address?: string;

  proof_of_delivery_url?: string;
  receiver_name?: string;

  notes?: string;

  dispatched_by?: string;

  // Joined data
  job?: Job;
  client?: Client;
}

// POS Category
export interface POSCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// POS Product
export interface POSProduct {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_active: boolean;
  created_at: string;
  category?: POSCategory;
}

// POS Sale
export interface POSSale extends BaseEntity {
  sale_number: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total_amount: number;
  payment_mode: PaymentMode;
  amount_received: number;
  change_amount: number;
  sold_by?: string;
  items?: POSSaleItem[];
}

// POS Sale Item
export interface POSSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

// Paper Stock
export interface PaperStock extends BaseEntity {
  name: string;
  size?: string;
  gsm?: number;
  quantity: number;
  unit: string;
  reorder_level: number;
  cost_per_unit: number;
  supplier?: string;
  last_restocked?: string;
}

// Activity Log
export interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: Profile;
}

// Counter
export interface Counter {
  id: string;
  prefix: string;
  current_number: number;
  financial_year?: string;
  updated_at: string;
}

// Note
export interface Note extends BaseEntity {
  content: string;
  color: string;
  is_pinned: boolean;
  user_id?: string;
}

// Reminder
export interface Reminder extends BaseEntity {
  title: string;
  description?: string;
  due_date: string;
  is_completed: boolean;
  priority: PriorityLevel;
  user_id?: string;
}

// =============================================
// API Response Types
// =============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  count?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =============================================
// Form Input Types (for creating/updating)
// =============================================

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>;
export type VendorInput = Omit<Vendor, 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>;
export type DesignerInput = Omit<Designer, 'id' | 'created_at' | 'updated_at'>;
export type JobInput = Omit<Job, 'id' | 'created_at' | 'updated_at' | 'job_number' | 'client' | 'vendor' | 'designer'>;
export type InvoiceInput = Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'invoice_number' | 'client' | 'job' | 'items'>;
export type LeadInput = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'lead_number' | 'assigned_user' | 'follow_ups'>;
