# Aayam Office System - Detailed Action Workflow

This document maps every single BUTTON CLICK and ACTION required to move a job through the system.

## 1. Marketing Chain (The "Lead to Order" Flow)

```mermaid
flowchart TD
    Start((Start)) --> LeadPage[Go to Marketing > Leads]
    
    LeadPage -->|Click '+ New Lead'| NewLeadForm[Fill Lead Form]
    NewLeadForm -->|Click 'Save Lead'| LeadCreated[Lead Created]
    
    LeadCreated -->|Click 'Create Quote'| QuotePage[Go to Marketing > Quotations]
    QuotePage -->|Click '+ Create Quote'| QuoteForm[Quote Builder]
    
    QuoteForm -->|Action: Add Items| AddItems[Add Items & Rates]
    AddItems -->|Click 'Save Quote'| QuoteSaved[Quote Saved]
    
    QuoteSaved -->|Action: Send to Client| ClientReview{Client Accepts?}
    ClientReview -- No -->|Click 'Mark Rejected'| End((End))
    ClientReview -- Yes -->|Click 'Convert to Order'| OrderCreated[Sales Order Created]
    
    OrderCreated --> ProductionStart((Production Start))
    
    style Start fill:#f9f,stroke:#333
    style OrderCreated fill:#bbf,stroke:#333
    style ProductionStart fill:#bfb,stroke:#333
```

---

## 2. Production Chain (The "Order to Job" Flow)

```mermaid
flowchart TD
    ProductionStart((From Order)) --> OrderPage[Go to Sales > Orders]
    
    OrderPage -->|Find Order & Click 'Create Job'| JobModal[Create Job Modal]
    
    JobModal -->|Action: Select Job Type| SelectType[Select Type: Box/Label/etc]
    SelectType -->|Action: Assign Designer| AssignPerson[Select Designer or 'Print Only']
    AssignPerson -->|Click 'Create Job'| JobActive[Job is Active in System]
    
    JobActive --> DesignNeeded{Design Required?}
    
    %% Design Path
    DesignNeeded -- Yes --> DesignView[Designer: Go to Design Studio]
    DesignView -->|Action: Drag to 'In Progress'| DesignStart[Design Started]
    DesignStart -->|Click 'Upload'| fileUp[Files Uploaded]
    fileUp -->|Click 'Clipboard Icon'| DesignQC[Open QC Checklist]
    DesignQC -->|Action: Check Boxes| QCpass[QC Passed]
    QCpass -->|Action: Drag to 'Approval'| ClientProof{Client Approves?}
    ClientProof -- No --> DesignStart
    ClientProof -- Yes -->|Action: Drag to 'Ready for Print'| PrintQueue[In Production Queue]
    
    %% Direct Path
    DesignNeeded -- No --> PrintQueue
    
    style JobActive fill:#d0f0c0,stroke:#333
    style PrintQueue fill:#fdd,stroke:#333
```

---

## 3. Dispatch & Finance Chain (The "Finish & Bill" Flow)

```mermaid
flowchart TD
    PrintQueue((Ready to Print)) --> PrintPlanner[Go to Projects > Print Planner]
    
    PrintPlanner -->|Action: Filter by Paper| Batching[Batch Similar Jobs]
    Batching -->|Action: Mark 'Printing'| Printing[Printing Started]
    Printing -->|Action: Mark 'Finishing'| Finishing[Cutting / Lamination]
    
    Finishing -->|Action: Mark 'Ready for Dispatch'| DispatchView[Go to Dispatch Page]
    
    DispatchView -->|Click 'Clipboard Icon'| DispatchQC[Open Dispatch QC Checklist]
    DispatchQC -->|Action: Verify Qty & Quality| QCVerified{Passed?}
    
    QCVerified -- No -->|Action: Mark Failed| Rework[Send for Rework]
    Rework --> PrintQueue
    
    QCVerified -- Yes -->|Click 'Create Dispatch'| ChallanModal[Dispatch Modal]
    ChallanModal -->|Action: Enter Driver/Courier| Dispatched[Item Dispatched]
    
    Dispatched --> InvoiceCheck{Invoice Created?}
    InvoiceCheck -- No -->|Go to Invoices > Click '+ Create'| MakeInvoice[Generate Invoice]
    MakeInvoice --> CollectPay
    InvoiceCheck -- Yes --> CollectPay[Go to Payments]
    
    CollectPay -->|Click '+ Record Payment'| Paid[Payment Recorded]
    Paid --> Done((Job Closed))
    
    style Dispatched fill:#ff9,stroke:#333
    style Done fill:#333,stroke:#fff,color:#fff
```

## 4. Key Button Actions Summary

| Phase | Button Name | Where to Find It | What it Does |
| :--- | :--- | :--- | :--- |
| **Sales** | **+ New Lead** | `Marketing > Leads` | Starts a new inquiry. |
| **Sales** | **+ Create Quote** | `Marketing > Quotations` | Create a price estimate. |
| **Sales** | **Convert to Order** | Inside a Quote Card | **Crucial Step**: Turns a quote into a confirmed order. |
| **Job** | **Create Job** | `Sales > Orders` | **Crucial Step**: Launches the job into production. Separates "Sales" from "Work". |
| **Design** | **Upload** (Cloud Icon) | `Design Studio` | Attaches files to the job. |
| **Design** | **QC Checklist** (Clipboard) | `Design Studio` | Opens the Design verification form (Bleed, Colors). |
| **Dispatch** | **Dispatch** (Truck Icon) | `Dispatch` Dashboard | Generates the Delivery Challan and marks job as sent. |
| **Finance** | **+ Create Invoice** | `Finance > Invoices` | Generates the bill. |
| **Finance** | **+ Record Payment** | `Finance > Payments` | Logs incoming money. |
