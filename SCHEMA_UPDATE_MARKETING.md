# Marketing Module Schema Updates

To support the new "Lead Card" system and enhanced workflow, please run the following SQL commands in your **Supabase SQL Editor**:

```sql
-- 1. Add Service Requirement (Lead Type)
ALTER TABLE leads ADD COLUMN lead_type text CHECK (lead_type IN ('printing_only', 'designing_only', 'design_printing'));

-- 2. Add Billing Preference
ALTER TABLE leads ADD COLUMN billing_preference text CHECK (billing_preference IN ('gst', 'non_gst', 'both'));

-- 3. Add Lost Reason (for closed leads)
ALTER TABLE leads ADD COLUMN lost_reason text;

-- 4. Enable efficient filtering for Dashboard
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
```

### Notes:
*   **Lead Type**: Categorizes the clear intent (Design vs Print).
*   **Billing Preference**: Helps in quoting immediately.
*   **Lost Reason**: Crucial for analytics.
