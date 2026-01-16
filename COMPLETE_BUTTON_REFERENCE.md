# Aayam Office System - Complete Button & Action Reference

This document provides a detailed breakdown of EVERY button, field, and action available in the system, organized by module.

---

## 1. MARKETING MODULE

### 1.1 Leads Page (`Marketing > Leads`)

**Primary Actions:**
- **`+ New Lead`** (Top right button)
  - Opens: Lead creation modal
  - Required Fields:
    - Client Name
    - Phone Number
    - Source (Dropdown: Website, Referral, Walk-in, etc.)
    - Requirement (Text area)
  - Action Button: **`Save Lead`**
  - Result: Creates new lead record

**Lead Card Actions:**
- **`Eye Icon`** - View full lead details
- **`Edit Icon`** - Modify lead information
- **`Phone Icon`** - Log a call/follow-up
- **`Quote Icon`** - Create quotation from this lead
- **`Trash Icon`** - Delete lead (requires confirmation)

**Status Filters:**
- `New` - Fresh inquiries
- `Contacted` - First call made
- `Qualified` - Interested leads
- `Won` - Converted to order
- `Lost` - Rejected/not interested

---

### 1.2 Quotations Page (`Marketing > Quotations`)

**Primary Actions:**
- **`+ Create Quote`** (Top right button)
  - Opens: Quote builder form
  - Fields:
    - Select Client/Lead (Dropdown)
    - Quote Date (Auto-filled)
    - Valid Until (Date picker)
    - Items Section:
      - **`+ Add Item`** - Adds new line item
        - Description
        - Quantity
        - Rate
        - GST %
      - **`Delete Icon`** - Remove line item
    - Notes (Optional text area)
  - Action Buttons:
    - **`Save as Draft`** - Saves without sending
    - **`Save & Generate PDF`** - Creates downloadable quote

**Quote Card Actions:**
- **`View PDF`** - Preview/download quotation
- **`Edit`** - Modify quote details
- **`Duplicate`** - Create copy for variation
- **`Convert to Order`** ⭐ **CRITICAL** - Moves to Sales Orders
- **`Mark Rejected`** - Close quote as lost
- **`Delete`** - Remove quote

---

### 1.3 Follow-ups Page (`Marketing > Follow-ups`)

**Primary Actions:**
- **`+ Schedule Follow-up`** (Top right)
  - Fields:
    - Select Lead/Client
    - Follow-up Date & Time
    - Follow-up Type (Call, Email, Visit)
    - Notes
  - Action: **`Schedule`**

**Follow-up Card Actions:**
- **`Mark Complete`** (Checkbox) - Close follow-up
- **`Reschedule`** - Change date/time
- **`Add Note`** - Log conversation details

---

## 2. SALES & FINANCE MODULE

### 2.1 Orders Page (`Sales & Finance > Orders`)

**Primary Actions:**
- Orders are created from Quotations (no direct "New Order" button)

**Order Card Actions:**
- **`Create Job`** ⭐ **CRITICAL** - Launches production workflow
  - Opens: Job creation modal
  - Fields:
    - Job Type (Dropdown: Box, Label, Visiting Card, Brochure, etc.)
    - Quantity (Number)
    - Job Description (Text)
    - Assign Designer (Dropdown: Designer names or "Print Only")
    - Client Deadline (Date picker)
    - Priority (Low, Normal, High, Urgent)
    - Special Instructions (Text area)
  - Action: **`Create Job`**
  - Result: Job appears in Production system
  
- **`View Details`** - Full order information
- **`Edit`** - Modify order (if not yet in production)
- **`Create Invoice`** - Generate bill
- **`Cancel Order`** - Mark as cancelled

**Status Indicators:**
- `Pending` - Awaiting job creation
- `In Production` - Job active
- `Completed` - Delivered
- `Cancelled` - Order cancelled

---

### 2.2 Invoices Page (`Sales & Finance > Invoices`)

**Primary Actions:**
- **`+ Create Invoice`** (Top right)
  - Select from existing Orders
  - OR create standalone invoice
  - Fields:
    - Client (Dropdown)
    - Invoice Date (Auto-filled)
    - Due Date (Date picker)
    - Items (Same as quotation builder)
    - Payment Terms (Text)
  - Action: **`Generate Invoice`**

**Invoice Card Actions:**
- **`View PDF`** - Download invoice
- **`Send Email`** - Email to client
- **`Record Payment`** - Opens payment modal
- **`Mark Paid`** - Quick action for full payment
- **`Edit`** - Modify invoice (if unpaid)
- **`Void`** - Cancel invoice

---

### 2.3 Payments Page (`Sales & Finance > Payments`)

**Primary Actions:**
- **`+ Record Payment`** (Top right)
  - Fields:
    - Select Client (Dropdown)
    - Select Invoice (Dropdown - shows outstanding invoices)
    - Payment Date (Date picker)
    - Amount Received (Number)
    - Payment Mode (Cash, UPI, Bank Transfer, Cheque)
    - Reference/Transaction ID (Text)
    - Notes (Optional)
  - Action: **`Save Payment`**

**Payment Record Actions:**
- **`View Receipt`** - Print payment receipt
- **`Edit`** - Modify payment details
- **`Delete`** - Remove payment record (requires confirmation)

---

## 3. DESIGN STUDIO MODULE

### 3.1 Design Tasks Page (`Design Studio`)

**View Toggles:**
- **`Board View`** - Kanban-style columns
- **`My Queue`** - Only tasks assigned to logged-in designer
- **`Team Queue`** - All design tasks
- **`Timeline`** - Calendar view

**Task Card Actions (in Board View):**
- **Drag & Drop between columns:**
  - `To Do` → `In Progress` → `Approval` → `Ready for Print`
  
- **`Upload Icon`** (Cloud/Upload symbol)
  - Opens: File upload dialog
  - Accepts: AI, PDF, JPG, PNG, TIFF
  - Action: Attach files to job
  
- **`Clipboard Icon`** - ⭐ **QC CHECKLIST**
  - Opens: Design QC modal
  - Checklist Items (checkboxes):
    - ☐ Bleed checked (3mm minimum)
    - ☐ Colors in CMYK mode
    - ☐ Fonts outlined/embedded
    - ☐ Spelling verified
    - ☐ Dimensions correct
    - ☐ Client changes applied
  - Progress bar shows completion %
  - Action: **`Save Checklist`**
  
- **`Comment Icon`** - Add internal notes
- **`Eye Icon`** - View job details
- **`Clock Icon`** - View time tracking

**Additional Actions:**
- **`+ New Project`** - Create design task manually (admin)
- **Filter** (Dropdown) - By status, designer, priority
- **Search** - Find jobs by client/description

---

## 4. PRODUCTION MODULE

### 4.1 Print Planner (`Projects & Jobs > Print Planner`)

**View Options:**
- **`Group by Paper Stock`** - Batch same paper jobs
- **`Group by Machine`** - Organize by printer
- **`Timeline View`** - Schedule-based view

**Job Card Actions:**
- **`Update Status`** (Dropdown)
  - Options: `Printing`, `Finishing`, `Ready for QC`
  
- **`View Files`** - Download print-ready files
- **`Production Notes`** - Log machine settings, issues
- **`Mark Complete`** - Move to dispatch queue

**Filters:**
- By Status
- By Priority
- By Deadline (Urgent first)

---

### 4.2 Jobs Overview (`Projects & Jobs > Overview`)

**Primary Actions:**
- **`+ Create Job`** (Top right) - Similar to "Create Job" from Orders

**Job Card Actions:**
- **`View Details`** - Full job information
- **`Edit`** - Modify job (if not started)
- **`Assign Designer`** - Change assigned person
- **`Set Priority`** - Change urgency level
- **`Cancel Job`** - Mark as cancelled

---

## 5. DISPATCH MODULE

### 5.1 Dispatch Dashboard (`Dispatch`)

**Primary Actions:**
- Jobs appear here when marked `Ready for Dispatch`

**Dispatch Card Actions:**
- **`Clipboard Icon`** - ⭐ **DISPATCH QC CHECKLIST**
  - Opens: Quality control modal
  - Checklist Items:
    - ☐ Print quality verified
    - ☐ Quantity counted (matches order)
    - ☐ Finishing quality checked
    - ☐ Packaging complete
    - ☐ Labels/stickers applied
  - QC Status: `Passed`, `Failed`, `Hold`
  - Action: **`Save QC Status`**
  
- **`Create Dispatch`** (Truck icon)
  - Opens: Dispatch modal
  - Fields:
    - Dispatch Date (Auto-filled)
    - Delivery Method (Own Vehicle, Courier, Client Pickup)
    - Driver Name / Courier Service
    - Vehicle Number (if applicable)
    - Tracking Number (if courier)
    - Notes
  - Action: **`Generate Challan & Dispatch`**
  - Result: Creates delivery document, updates inventory
  
- **`View Challan PDF`** - Download delivery note
- **`Mark Delivered`** - Confirm receipt
- **`Return`** - Mark as returned/rejected

**Status Filters:**
- `Pending QC` - Awaiting quality check
- `Ready to Ship` - QC passed
- `Dispatched` - On the way
- `Delivered` - Received by client

---

## 6. CRM MODULE

### 6.1 Clients Page (`CRM > Clients`)

**Primary Actions:**
- **`+ New Client`** (Top right)
  - Fields:
    - Company Name
    - Contact Person
    - Phone
    - Email
    - Address
    - GST Number (Optional)
    - Credit Limit (Optional)
  - Action: **`Save Client`**

**Client Card Actions:**
- **`View Profile`** - See complete history
  - Shows: All orders, invoices, payments, outstanding balance
- **`Edit`** - Update client info
- **`Create Quote`** - Quick action to start sale
- **`Statement`** - Download account statement
- **`Delete`** - Remove client (if no transactions)

---

## 7. SETTINGS MODULE

### 7.1 Production Settings (`Settings > Production`)

**Tabs:**
- **`Pre-Print (Design)`** - Design QC checklists
- **`QC & Dispatch`** - Dispatch QC checklists

**Actions (per tab):**
- **`+ Add Job Type`** (Top right)
  - Input: Job Type Name (e.g., "Box", "Label")
  - Auto-creates checklist template
  
- **Per Job Type Card:**
  - **`+ Add Item`** - Add checklist point
    - Input: Checklist item text (e.g., "Check bleed")
    - Action: **`Save`**
  - **`Edit Icon`** (on each item) - Modify text
  - **`Delete Icon`** (on each item) - Remove item
  - **`Save Checklist`** - Confirm all changes
  - **`Delete Job Type`** - Remove entire template

---

## 8. COMMON UI ELEMENTS

### Global Navigation
- **Sidebar Menu** - Click modules to navigate
- **Search** (Top bar) - Global search
- **Notifications** (Bell icon) - System alerts
- **User Menu** (Avatar/Name) - Settings, Logout

### Data Tables (Common in most pages)
- **`Sort`** - Click column headers
- **`Filter`** - Dropdown filters
- **`Search`** - Text search within page
- **`Export`** - Download as CSV/Excel
- **`Bulk Select`** (Checkboxes) - Select multiple items
- **`Bulk Actions`** - Actions on selected items

### Forms (Common patterns)
- **`Cancel`** - Close modal/form without saving
- **`Save as Draft`** - Save partial data
- **`Save`** / **`Submit`** - Confirm action
- **`Delete`** - Remove record (usually with confirmation)

---

## 9. KEY WORKFLOW BUTTONS (Critical Path)

These are the essential buttons that drive work forward:

| Button | Location | What It Does |
|--------|----------|--------------|
| **`+ New Lead`** | Marketing > Leads | Start new sales inquiry |
| **`+ Create Quote`** | Marketing > Quotations | Send price estimate |
| **`Convert to Order`** | Inside Quote card | ⭐ Move to production |
| **`Create Job`** | Sales > Orders | ⭐ Create work order |
| **`Upload`** | Design Studio | Attach design files |
| **`Clipboard (Design QC)`** | Design tasks | Verify design quality |
| **`Drag to Ready for Print`** | Design board | Release to production |
| **`Update Status`** | Print Planner | Track manufacturing |
| **`Clipboard (Dispatch QC)`** | Dispatch | Final quality check |
| **`Create Dispatch`** | Dispatch | Ship to client |
| **`+ Create Invoice`** | Finance > Invoices | Generate bill |
| **`+ Record Payment`** | Finance > Payments | Log money received |

---

## 10. PERMISSION NOTES

Different user roles see different buttons:

- **Admin**: All buttons visible
- **Manager**: Most buttons visible
- **Designer**: Only Design Studio + limited views
- **Marketing**: Leads, Quotes, Follow-ups
- **Dispatch**: Only Dispatch module
- **Finance**: Only Finance & invoicing

---

**Last Updated:** 2026-01-16  
**System Version:** v1.7.0
