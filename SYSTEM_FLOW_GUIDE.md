## 1. High-Level Data Flow Diagram
This chart shows how different modules interact with the core database tables.

```mermaid
graph TD
    %% Core Entities
    Client[Client Database] -->|Linked To| Quotation[Quotations]
    Client -->|Linked To| Job[Projects & Jobs]
    Client -->|Linked To| Invoice[Finance/Invoices]

    %% Leads Flow
    Lead[Marketing Leads] -->|Converted| Client
    Lead -->|Generates| Quotation

    %% Job Flow
    Quotation -->|Approved| Order[Sales Orders]
    Order -->|Converted| Job
    
    %% Production Chain (Split Logic)
    Job -->|Assign Designer| Designer[Designer Workspace]
    Designer -->|Design Approved| Decision{Production Type?}

    %% Path A: In-House (Small Work)
    Decision -->|Small Digital/Labels (13x19)| InHouse[CMYK Print Queue]
    InHouse -->|Printed| Dispatch

    %% Path B: Outsourced (Core Revenue)
    Decision -->|Boxes/Pouches| Vendor[Vendor / Outsourced]
    Vendor -->|Sent to Vendor| Manufacturing[Vendor Production]
    Manufacturing -->|Received Quality Check| Dispatch

    %% Final Step
    Dispatch[Dispatch & Delivery] -->|Bill| Invoice
    
    %% Finance Links
    Vendor -->|Supplies Material| Expense[Finance Expenses]
    
    %% Styles
    style Job fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style Client fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style InHouse fill:#e0f7fa,stroke:#006064,stroke-width:2px
    style Vendor fill:#fbe9e7,stroke:#bf360c,stroke-width:4px
```

---

## 2. Sidebar Button Guide
Below is the breakdown of each button in your menu, what data it holds, and its purpose.

### 📊 Overview & Projects
| Button Name | Data Source | Connects To | Purpose |
| :--- | :--- | :--- | :--- |
| **Overview** | All Tables | N/A | **Snapshot:** View total revenue, pending jobs, and active leads at a glance. |
| **Projects & Jobs** | `jobs` table | **Designers**, **Finance**, **Dispatch** | **The Core:** Where you create new work orders. Inputs client info and design briefs. Outputs tasks for designers. |
| **Design Tasks** | `jobs` (filtered) | **Projects** | **For Designers:** A focused view where designers see *only* their assigned work, create notes, and chat. |

### 📢 Marketing & Sales (The Funnel)
| Button Name | Data Source | Connects To | Purpose |
| :--- | :--- | :--- | :--- |
| **Leads** | `leads` table | **Clients** | Track potential customers. When valid, "Convert to Client". |
| **Quotations** | `quotations` | **Orders** | Create price estimates. If approved, "Convert to Order". |
| **Orders** | `orders` | **Jobs** | Confirmed deals awaiting execution. "Convert to Job" moves it to production. |
| **Follow-ups** | `tasks/reminders` | **Leads/Clients** | Schedule calls or meetings so you never forget a customer. |

### 👥 CRM (Relationships)
| Button Name | Data Source | Connects To | Purpose |
| :--- | :--- | :--- | :--- |
| **Clients** | `clients` table | **Jobs**, **Invoices** | **Master Database:** Stores Name, Phone, GST, Address. Referenced by *every* other module. |
| **Vendors** | `vendors` table | **Expenses** | Stores info about printers, paper suppliers, etc. |

### 🎨 Designers Management
| Button Name | Data Source | Connects To | Purpose |
| :--- | :--- | :--- | :--- |
| **Designers Mgmt** | `designers` table | **Jobs** | **Admin Only:** Add new staff, set salaries, upload identity docs (`document_url`), and view performance stats. |

### 🚚 Production & Delivery
| Button Name | Data Source | Connects To | Purpose |
| :--- | :--- | :--- | :--- |
| **CMYK Print** | `jobs` (filtered) | **Dispatch** | **For Digital Operator:** Shows jobs marked for **In-House** printing (13x19 paper/labels). |
| **Vendor Jobs** | `jobs` (Vendor Assgn) | **Dispatch** | *(Conceptual View)*: Monitor jobs sent to external factories (Boxes/Pouches). Currently tracked in Projects List. |
| **Dispatch** | `dispatch` | **Clients** | Manage shipping, tracking numbers, and delivery confirmation. |

### ₹ Finance
| Button Name | Data Source | Connects To | Purpose |
| :--- | :--- | :--- | :--- |
| **Finance** | `invoices`, `expenses` | **Bank Accounts** | Track money in (Invoices) vs money out (Vendor Payments, Salaries). |

---

## 3. "Convert" Button Logic
The most powerful features in your system are the **Conversion Buttons** which move data automatically so you don't have to re-type it.

1. **Lead -> Client:** Saves a potential customer permanently.
2. **Client -> Quote:** Starts a pricing estimate.
3. **Quote -> Job:** Turns an estimate into live work.
4. **Job -> Invoice:** Turns finished work into a billable invoice.

This ensures that once a client enters your system as a Lead, their data flows smoothly all the way to the Final Invoice without double entry.
