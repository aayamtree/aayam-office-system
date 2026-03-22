import { NextResponse } from 'next/server';
const msg = { error: 'This endpoint is deprecated. Use /api/jobs instead.' };
export async function GET() { return NextResponse.json(msg, { status: 410 }); }
export async function POST() { return NextResponse.json(msg, { status: 410 }); }
export async function PATCH() { return NextResponse.json(msg, { status: 410 }); }
export async function PUT() { return NextResponse.json(msg, { status: 410 }); }
export async function DELETE() { return NextResponse.json(msg, { status: 410 }); }