# Marketing & Commission System Setup

To enable the commission system for your marketing team, please follow these steps.

## 1. Update Database Schema
Run the following SQL in your **Supabase SQL Editor** to add commission tracking fields.

```sql
-- 1. Add Commission Rate to User Profiles
ALTER TABLE profiles 
ADD COLUMN commission_rate numeric DEFAULT 0;

-- 2. Add Marketing Person to Orders (Jobs)
-- Ideally links the job to the profile who closed it
ALTER TABLE jobs 
ADD COLUMN sales_person_id uuid REFERENCES profiles(id);
```

## 2. Managing Commission Rates
Once the column is added, you can go to the `users` or `profiles` table in Supabase and set the `commission_rate` for each marketing employee (e.g., `5.0` for 5%).

## 3. Workflow for Commissions
1. **Lead Generation**: Marketing person adds a Lead. It is linked to them.
2. **Quotation**: Marketing person creates a Quotation. It is linked to them.
3. **Conversion**: When converting a Quote to an Order, ensure the **Marketing Person** is preserved.
   * *Note:* Currently, the system uses the logged-in user as the creator. If an Admin converts the quote, the Admin might become the creator. 
   * *Recommendation:* We should update the Order creation logic to copy the `created_by` from the Quotation to the `sales_person_id` of the Job.

## 4. Commission Calculation Logic
Commission is calculated on the **Net Amount** (Total - GST).

**Formula:**
`Commission = (Job Subtotal - Discount) * (Commission Rate / 100)`

## 5. View Commissions
You can request a new **"Commission Report"** page to be built, which will:
1. List all `paid` jobs.
2. Group them by `sales_person_id`.
3. Calculate the total commission payable.
