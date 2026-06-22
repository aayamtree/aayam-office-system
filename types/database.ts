// =============================================
// AAYAM OFFICE - DATABASE TYPES
// =============================================

// Enums
export type UserRole = 'admin' | 'manager' | 'sales' | 'designer' | 'dispatch' | 'marketing' | 'finance' | 'cmyk';
export type JobStatus = 'new' | 'awaiting_admin' | 'file_check' | 'designing' | 'approval' | 'pre_print_qc' | 'print_file_ready' | 'file_sent_client' | 'file_received' | 'ready_to_print' | 'printing' | 'material_received' | 'finishing' | 'quality_check' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
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
  avatar_url?: string;  // Google Drive photo link
  is_active: boolean;
  commission_rate?: number;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_linked_at?: string | null;
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

  // Enhanced fields for admin monitoring
  project_type?: 'print' | 'design' | 'design_print';
  quantity?: number;
  estimated_amount?: number;
  deadline?: string;

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
  // Delivery / shipping address (separate from billing/office address)
  delivery_same_as_billing?: boolean;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pincode?: string;
  client_type: 'regular' | 'premium' | 'corporate';
  credit_limit: number;
  outstanding_balance: number;
  notes?: string;
  is_active: boolean;
  assigned_to?: string;  // Marketing person assigned to this client
  created_by?: string;
  source?: 'direct' | 'marketing' | string;  // How this client was acquired
  brand_name?: string;  // Searchable brand names (hashtag format: #tiger #cobra)
  referred_by?: string;  // UUID of the client who referred this client
  
  // Telegram
  telegram_chat_id?: string;
  telegram_username?: string;
  telegram_linked_at?: string;

  // Opening balance
  opening_balance?: number;
  opening_balance_date?: string;
  opening_balance_type?: 'debit' | 'credit';

  // Joined data
  referrer?: Client;  // The client who referred this one
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
  opening_balance?: number;
  opening_balance_date?: string;
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
  sales_order_id?: string;

  job_type?: 'Print Only' | 'Design Only' | 'Design + Print';
  product_category?: string; // Single source of truth for category
  description?: string;
  quantity: number;
  actual_quantity?: number;  // Actual produced qty (for overrun/underrun tracking)

  // Financial fields
  quote_per_piece: number;
  design_charge?: number;   // Flat design fee (used for design_only / design_print jobs)
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  base_price?: number; // New field

  payment_status: PaymentStatus;
  amount_received: number;

  // Advance payment tracking
  advance_required?: boolean;
  advance_collected?: boolean;
  advance_amount?: number;
  advance_payment_mode?: string;  // 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'neft' | 'rtgs'

  // Dates
  order_date: string;
  client_deadline?: string;
  internal_deadline?: string;
  completed_date?: string;

  // Workflow status
  current_stage: JobStatus;
  priority: PriorityLevel;

  // Print-specific fields (new)
  client_approval?: boolean;
  approval_date?: string;
  approval_by?: string;       // Who from our side got the approval (user ID)
  approval_remark?: string;   // What client said / final direction
  approval_status?: 'pending' | 'sent' | 'approved' | 'changes_requested';
  print_ready?: boolean;

  // Hold feature
  is_on_hold?: boolean;
  hold_reason?: string;
  pre_hold_stage?: string;
  revision_count?: number;
  file_version?: string;

  // Files and notes
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
  product_category_rel?: ProductCategory; // Renamed to avoid conflict
  checklist_progress?: Record<string, boolean>; // Design QC
  dispatch_checklist_progress?: Record<string, boolean>; // Dispatch QC
  qc_status?: 'pending' | 'passed' | 'failed' | 'hold';
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
  sales_order_id?: string;

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
  sales_order_id?: string;

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
  item_notes?: string;   // sub-description (second line under item name)
  hsn_code?: string;
  quantity: number;
  rate: number;
  amount: number;
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

// Purchase Bill line item (stored in items JSONB column)
export interface PurchaseBillItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  subtotal: number;
  gst_amount: number;
  total: number;
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
  unit?: string;
  rate: number;

  // Multi-line items stored as JSONB
  items?: PurchaseBillItem[];

  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;

  payment_status: PaymentStatus;
  amount_paid: number;

  bill_date: string;
  due_date?: string;
  payment_terms?: string;
  attachment_url?: string;

  discount_percent?: number;
  discount_amount?: number;
  adjustment?: number;
  reverse_charge?: boolean;

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
  bank_name?: string;
  account_number: string;
  ifsc_code?: string;
  branch?: string;
  account_type: 'current' | 'savings' | 'od' | 'cc' | 'cash';

  opening_balance: number;
  opening_balance_date?: string;
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

  // Categorization fields
  is_verified?: boolean;
  verified_by?: string;
  verified_at?: string;
  categorization_type?: 'expense' | 'income' | 'transfer' | null;
  expense_category_id?: string | null;
  income_category_id?: string | null;
  expense_type?: 'goods' | 'services' | null;
  payment_method?: string | null;
  categorization_notes?: string | null;
  payee_name?: string | null;
  vendor_id?: string | null;
  direct_payee_id?: string | null;
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
  job_id?: string;  // Optional link to a specific job

  // Joined data
  job?: Job;
}



// Follow Up
export interface FollowUp {
  id: string;
  lead_id?: string;
  client_id?: string;
  quotation_id?: string;
  done_by?: string;
  follow_up_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Joined
  lead?: Lead;
  client?: Client;
  quotation?: Quotation;
}

// Quotation
export interface Quotation extends BaseEntity {
  quote_number: string;

  client_id?: string | null;
  lead_id?: string | null;

  order_type?: 'print' | 'design' | 'design_print';
  product_category?: string;

  status: QuoteStatus;

  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;

  valid_until?: string | null;

  terms?: string;
  notes?: string;

  converted_to_job_id?: string;

  created_by?: string;

  // Joined data
  client?: Client;
  lead?: Lead;
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
  product_category?: string; // Per-item category (Box/Label/Pouch) — routes each item to its production channel
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
  client_id?: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  // GST (retail counter is always GST-billed)
  gst_rate?: number;
  gst_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  gstin?: string;
  total_amount: number;
  payment_mode: PaymentMode;
  amount_received: number;
  change_amount: number;
  payment_status?: 'paid' | 'pending' | 'partial';
  due_date?: string;
  balance_due?: number;
  credit_terms?: string;
  paper_stock_id?: string;
  sheets_used?: number;
  // Order fulfilment
  order_type?: 'walkin' | 'pickup';
  pickup_status?: 'pending' | 'ready' | 'collected';
  pickup_date?: string;
  artwork_link?: string;
  notes?: string;
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

// Quotation Line Item
export interface QuotationLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// Sales Order (New Module)
export interface SalesOrder extends BaseEntity {
  so_number: string;
  client_id: string;
  quotation_id?: string;

  order_date: string;
  work_type: 'design_only' | 'print_only' | 'design_and_print';

  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;

  status: 'draft' | 'confirmed' | 'in_progress' | 'ready_for_invoice' | 'invoiced' | 'completed' | 'cancelled';
  payment_status: PaymentStatus;

  project_name: string;
  description?: string;
  quantity: number;

  created_by?: string;

  // Joins
  client?: Client;
  quotation?: Quotation;
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
  category?: string;
  size_width?: number;
  size_height?: number;
  is_active?: boolean;
}

// CMYK Expense
export interface CMYKExpense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  description?: string;
  job_id?: string;
  pos_sale_id?: string;
  approved_by?: string;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}



// CMYK Job Log
export interface CMYKJobLog {
  id: string;
  job_id?: string;
  job_number?: string;
  client_name?: string;
  project_name?: string;
  paper_stock_id?: string;
  paper_name?: string;
  sheets_used: number;
  paper_cost: number;
  operator_id?: string;
  operator_name?: string;
  started_at: string;
  completed_at?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

// CMYK Paper Purchase
export interface CMYKPaperPurchase {
  id: string;
  purchase_date: string;
  vendor_id?: string;
  vendor_name?: string;
  paper_stock_id?: string;
  paper_name?: string;
  quantity: number;
  unit: string;
  rate: number;
  total_amount: number;
  gst_percent: number;
  gst_amount: number;
  grand_total: number;
  payment_status: 'paid' | 'pending' | 'partial';
  amount_paid: number;
  purchase_bill_id?: string;
  invoice_number?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Counter
export interface Counter {
  id: string;
  prefix: string;
  current_number: number;
  financial_year?: string;
  updated_at: string;
}

export interface GoogleDriveCredentials extends BaseEntity {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  scopes: string;
  connected_by?: string;
  connected_at: string;
  is_active: boolean;
  last_used_at?: string;
}

// Note
export interface Note extends BaseEntity {
  title?: string;
  content: string;
  color: string;
  is_pinned: boolean;
  user_id?: string;
  tagged_users?: string[];
  mentioned_users?: string[];
  shared_with?: string[];
  note_date?: string;
  linked_job_id?: string;
  job?: Job; // For joined data
}

// Reminder
export interface Reminder extends BaseEntity {
  title: string;
  description?: string;
  due_date?: string | null; // Optional
  is_completed: boolean;
  priority: PriorityLevel;
  user_id?: string;
}

// Checklist
export interface JobChecklist {
  id: string;
  job_type: string;
  category: 'design' | 'dispatch';
  items: string[]; // JSONB stored as array of strings
  created_at: string;
}

// Job Note (Project Feedback/Notes Log)
export type NoteTag = 'correction' | 'update' | 'client_says' | 'approved' | 'approved_closed' | 'design_note';
export type NoteSource = 'call' | 'whatsapp' | 'in_person' | 'self';

export interface JobNote {
  id: string;
  job_id: string;
  user_id: string;
  content: string;
  tag: NoteTag;
  source: NoteSource;
  created_at: string;
  // Joined data
  user?: Profile;
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

// Activity Log
export interface ActivityLog {
  id: string;
  user_id: string;
  user?: Profile; // linked
  action: string;
  module?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

// User Calendar Events - Personal calendar for each user
export interface UserCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  event_type: 'task' | 'meeting' | 'reminder' | 'personal';
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  all_day: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  color: string;
  is_recurring: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly';
  recurrence_end_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string;
  created_at: string;
  updated_at: string;
  tagged_users?: string[];  // Array of user IDs who are tagged/mentioned
  visibility?: 'private' | 'team' | 'all';  // Who can see this event
  source?: 'manual' | 'auto';  // Auto = system-generated
  source_type?: 'job' | 'followup' | 'dispatch' | 'invoice' | 'task';  // Origin entity
  source_id?: string;  // Link back to source entity
}

export interface CalendarEventMention {
  id: string;
  event_id: string;
  tagged_user_id: string;
  notified: boolean;
  created_at: string;
}

// Product Requirements (for Design + Print orders)
export interface ProductRequirement extends BaseEntity {
  job_id?: string;
  quotation_id?: string;

  product_category: "box" | "pouch" | "label" | "sticker" | "other";
  product_name?: string;

  specifications: Record<string, any>; // JSONB field

  collected_by?: string;
  collected_at?: string;
  forwarded_to_design: boolean;
  forwarded_at?: string;

  reference_files: string[];
  notes?: string;
}

// Commission (Marketing)
export interface Commission extends BaseEntity {
  job_id?: string;
  quotation_id?: string;
  order_id?: string;
  marketing_person_id: string;
  marketing_person?: Profile;
  project_name?: string;
  project_total_amount: number;
  gst_percentage: number;
  gst_amount?: number;
  base_amount?: number;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  commission_amount?: number;
  is_eligible: boolean;
  quote_status?: string;
  payment_status?: string;
  payment_received_date?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  salary_month?: string;
  paid_at?: string;
  paid_by?: string;
  payment_reference?: string;
  notes?: string;
  created_by?: string;
}

// =============================================
// PRINT PLANNER & CONFIGURATION TABLES
// =============================================

// Machine configuration
export interface Machine extends BaseEntity {
  name: string;
  description?: string;
  is_active: boolean;
}

// Sheet Size configuration
export interface SheetSize extends BaseEntity {
  size: string;
  description?: string;
  is_active: boolean;
}

// Material configuration
export interface Material extends BaseEntity {
  name: string;
  description?: string;
  is_active: boolean;
}

// Product Category
export interface ProductCategory extends BaseEntity {
  name: string;
  description?: string;
  production_checklist_id?: string;
  is_active: boolean;
}

// Print Run (container for multiple jobs)
export interface PrintRun extends BaseEntity {
  print_run_number: string;
  machine_id?: string;
  sheet_size_id?: string;
  material_id?: string;
  vendor_id?: string;
  status: 'planned' | 'at_printer' | 'printing_done' | 'qc' | 'dispatched';
  notes?: string;
  created_by?: string;
  deadline?: string;
  total_amount?: number;

  // Sheet config from Step 2
  sheet_size_label?: string;
  pulling_multiple?: number;

  // Paper supply fields
  paper_vendor_id?: string;
  paper_qty?: number;
  paper_rate?: number;
  paper_gst_percent?: number;
  paper_total?: number;
  paper_payment_status?: 'paid' | 'pending';

  // Delivery & dispatch
  delivery_mode?: 'warehouse' | 'direct_to_client';
  delivery_address?: string;
  transporter_name?: string;
  eway_bill_number?: string;
  dispatch_date?: string;
  invoice_reference?: string;

  // QC
  qc_checklist?: Record<string, boolean>;
  qc_notes?: string;

  // Joined data
  machine?: Machine;
  sheet_size?: SheetSize;
  material?: Material;
  jobs?: PrintRunJob[];
  print_run_jobs?: PrintRunJob[]; // Alias for Supabase query
}


// Print Run Job (junction table)
export interface PrintRunJob extends BaseEntity {
  print_run_id: string;
  job_id: string;
  client_name?: string;
  item_name?: string;
  qty_on_sheet?: number;
  quantity_needed?: number;
  ups_in_sheet?: number;
  sheets_to_print?: number;    // How many sheets to print for this job
  expected_output?: number;    // Auto: ups_in_sheet × sheets_to_print
  actual_output?: number;      // Actual produced (for overrun tracking)
  received_qty?: number;       // Actual qty received from printer (QC)
  file_version?: string;
  notes?: string;
  added_at: string;

  // Joined data
  print_run?: PrintRun;
  job?: Job;
}


// Production Summary (for dashboard)
export interface ProductionSummary {
  design_stage: number;
  print_ready: number;
  awaiting_approval: number;
  high_priority: number;
  in_production: number;
  total_active: number;
}

// Payment Split (for tracking multi-mode payments)
export interface PaymentSplit extends BaseEntity {
  payment_id: string;     // FK to payments_received
  amount: number;
  payment_mode: PaymentMode;
  bank_account_id?: string;
  reference_number?: string;
  has_gst: boolean;       // Whether GST applies to this split

  // Joined data
  payment?: PaymentReceived;
  bank_account?: BankAccount;
}

// User Note (dashboard sticky notes)
export interface UserNote extends BaseEntity {
  user_id: string;
  content: string;
  note_type: 'personal' | 'pinned' | 'shared';
  tagged_users?: string[];   // Who can see shared notes
  job_id?: string;           // Optional link to a job
  is_archived: boolean;

  // Joined data
  creator?: Profile;
  job?: Job;
}


// QC Record (audit trail for quality checks)
export interface QcRecord {
  id: string;
  job_id?: string;
  print_run_id?: string;
  qc_type: 'pre_print' | 'post_print' | 'print_run' | 'remote';
  checklist: Record<string, boolean>;
  result: 'passed' | 'failed' | 'rework';
  notes?: string;
  received_qty?: number;
  photos?: string[];  // URLs for remote QC photos
  skip_reason?: string;
  performed_by?: string;
  performed_by_name?: string;
  performed_at: string;
  design_file_url?: string;
  created_at: string;

  // Joined
  job?: Job;
  print_run?: PrintRun;
}

export type MachineInput = Omit<Machine, 'id' | 'created_at' | 'updated_at'>;
export type SheetSizeInput = Omit<SheetSize, 'id' | 'created_at' | 'updated_at'>;
export type MaterialInput = Omit<Material, 'id' | 'created_at' | 'updated_at'>;
export type ProductCategoryInput = Omit<ProductCategory, 'id' | 'created_at' | 'updated_at'>;
export type PrintRunInput = Omit<PrintRun, 'id' | 'created_at' | 'updated_at' | 'print_run_number' | 'machine' | 'sheet_size' | 'material' | 'jobs'>;
export type PrintRunJobInput = Omit<PrintRunJob, 'id' | 'created_at' | 'updated_at' | 'added_at' | 'print_run' | 'job'>;
export type PaymentSplitInput = Omit<PaymentSplit, 'id' | 'created_at' | 'updated_at' | 'payment' | 'bank_account'>;
export type UserNoteInput = Omit<UserNote, 'id' | 'created_at' | 'updated_at' | 'creator' | 'job'>;

// =============================================
// DESIGNER MODULE TYPES (Step 1–9)
// =============================================

export type DesignerAttendanceStatus = 'active' | 'idle' | 'logged_out' | 'absent';
export type DesignTaskStatus = 'created' | 'live' | 'hold' | 'review' | 'rework' | 'end';
export type DesignTaskPriority = 'normal' | 'urgent' | 'critical';
export type ProductTypeCategory = 'packaging' | 'print' | 'digital' | 'other';
export type DossierEntryType =
  | 'TASK_CREATED' | 'LIVE_STARTED' | 'LIVE_PAUSED' | 'HOLD_APPLIED'
  | 'TASK_TRANSFERRED' | 'REVIEW_STARTED' | 'REWORK_CREATED' | 'TASK_ENDED'
  | 'STATUS_CHANGED';

export interface DesignerAttendance {
  id: string;
  designer_id: string;
  date: string;
  first_login_time: string;
  last_logout_time?: string;
  last_heartbeat_time?: string;
  status: DesignerAttendanceStatus;
  total_minutes_worked: number;
  created_at: string;
  updated_at: string;
}

export interface ProductTypeNew {
  id: string;
  name: string;
  category: ProductTypeCategory;
  is_active: boolean;
  created_at: string;
}

export interface DesignTaskNew extends BaseEntity {
  task_code: string;
  client_id?: string;
  brand_id?: string;
  product_type_id?: string;
  description?: string;
  dimensions?: string;
  deadline?: string;
  priority: DesignTaskPriority;
  current_status: DesignTaskStatus;
  rework_count: number;
  created_by?: string;
  assigned_to?: string;
  is_draft: boolean;

  // Joined data
  client?: Client;
  product_type?: ProductTypeNew;
  assigned_user?: Profile;
  created_user?: Profile;
  task_status_history?: TaskStatusHistoryEntry[];
  task_time_sessions?: TaskTimeSession[];
}

export interface TaskStatusHistoryEntry {
  id: string;
  task_id: string;
  from_status?: DesignTaskStatus;
  to_status: DesignTaskStatus;
  changed_by?: string;
  changed_at: string;
  reason?: string;
  rework_number?: number;
  changer?: { full_name: string };
}

export interface TaskTimeSession {
  id: string;
  task_id: string;
  designer_id: string;
  session_start: string;
  session_end?: string;
  duration_minutes?: number;
  pause_reason?: string;
  created_at: string;
}

export interface TaskTransfer {
  id: string;
  task_id: string;
  transferred_from?: string;
  transferred_to: string;
  transferred_by?: string;
  reason?: string;
  transferred_at: string;
}

export interface DossierEntry {
  id: string;
  task_id: string;
  entry_type: DossierEntryType;
  actor_id?: string;
  data_json: Record<string, any>;
  created_at: string;
  actor?: Profile;
}

