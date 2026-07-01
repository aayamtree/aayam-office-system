import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * DELETE /api/cmyk-print/sales/[id]
 *
 * Deletes a POS bill. ADMIN ONLY — enforced server-side (UI hiding is not a lock).
 *  - pos_sale_items are removed automatically (FK ON DELETE CASCADE).
 *  - paper stock is restored automatically (AFTER DELETE trigger).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();

  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await auth
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (caller?.role !== 'admin') {
    return NextResponse.json(
      { error: `Only admins can delete a bill. Your role: ${caller?.role || 'unknown'}` },
      { status: 403 }
    );
  }

  // Service-role client for the actual delete (reliable regardless of session state).
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : auth;

  // Fetch for audit + to confirm it exists.
  const { data: sale } = await service
    .from('pos_sales')
    .select('id, sale_number, total_amount, customer_name')
    .eq('id', id)
    .single();
  if (!sale) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

  const { error } = await service.from('pos_sales').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`[POS delete] Bill ${sale.sale_number} (${sale.customer_name || 'Walk-in'}, ₹${sale.total_amount}) deleted by ${caller?.full_name || user.email} (admin).`);

  return NextResponse.json({ success: true, deleted: sale.sale_number });
}
