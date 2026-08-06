'use client';

/**
 * /admin/designers used to be a third staff directory — 653 lines reading and
 * writing the SAME `profiles` rows as Settings → Designers Directory and
 * Settings → Team Management. Three doors onto one table, each showing a
 * different slice, so nobody could tell which one owned a field.
 *
 * Team Management is now the single people page. Nothing linked here (it was
 * absent from the sidebar), so this is a signpost rather than a redirect —
 * a designer landing here has no access to Team Management (admin only) and
 * should be told, not silently bounced to a Forbidden screen.
 *
 * The old implementation is in git history if any of it is ever wanted back.
 */

import Link from 'next/link';
import { Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function DesignersDirectoryMoved() {
    const { isAdmin } = useAuth();

    return (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Users className="h-6 w-6 text-gray-700" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">This directory has moved</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                Designers are staff records with the designer role — the same rows as everyone
                else. They are all managed in one place now, together with contact details, rate,
                skills, access and Telegram.
            </p>

            {isAdmin ? (
                <Link
                    href="/admin/settings/users"
                    className="mt-6 inline-block rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                    Open Team Management
                </Link>
            ) : (
                <p className="mt-6 text-sm text-gray-500">
                    Ask an admin if you need a detail changed. Your own profile is under{' '}
                    <Link href="/admin/settings/profile" className="text-blue-700 underline">
                        My Profile
                    </Link>
                    .
                </p>
            )}
        </div>
    );
}
