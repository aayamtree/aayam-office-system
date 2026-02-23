import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()

    // Create Supabase server client for middleware — refreshes auth tokens
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        res.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh the session — this keeps auth tokens alive
    // and writes updated cookies to the response
    const { data: { session } } = await supabase.auth.getSession()

    // Protect admin routes — redirect to login if no session
    if (!session && req.nextUrl.pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    return res
}

export const config = {
    matcher: ['/admin/:path*'],
}
