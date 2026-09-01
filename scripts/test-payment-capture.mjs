// Test the payment-screenshot extractor against a real receipt.
//
//   node scripts/test-payment-capture.mjs [path/to/screenshot.jpg]
//
// Defaults to scripts/fixtures/payment-onyx-print.jpg — a genuine HDFC
// receipt that says "Request Accepted". If the extractor ever reports that
// as "Successful", this test has caught the most dangerous possible bug in
// the pipeline: an unconfirmed payment presented as a completed one.

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

const imagePath = process.argv[2] || 'scripts/fixtures/payment-onyx-print.jpg';
const buffer = fs.readFileSync(imagePath);
const ext = path.extname(imagePath).toLowerCase();
const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

// Kept in sync by hand with lib/payment-capture.ts (this script is plain ESM
// and cannot import the TypeScript module without a build step).
const SYSTEM_PROMPT =
    'You read Indian bank payment receipts and UPI/NEFT/IMPS confirmation screenshots. ' +
    'Return ONLY valid JSON, no markdown fences, no commentary.';

const USER_PROMPT = fs.readFileSync('lib/payment-capture.ts', 'utf8')
    .split('const USER_PROMPT = `')[1]
    .split('`;')[0];

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
        role: 'user',
        content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
            { type: 'text', text: USER_PROMPT },
        ],
    }],
});

const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
console.log(JSON.stringify(json, null, 2));

if (imagePath.includes('payment-onyx-print')) {
    const checks = [
        ['is a receipt', json.is_payment_receipt === true],
        ['amount 22700', Number(json.amount) === 22700],
        ['payee is Onyx print', /onyx/i.test(json.paid_to || '')],
        ['date 2026-09-01', json.txn_date === '2026-09-01'],
        ['status NOT upgraded to Successful', !/success/i.test(json.gateway_status || '')],
        ['status kept verbatim', /request accepted/i.test(json.gateway_status || '')],
        ['txn id read', (json.transaction_id || '').includes('HDFC9A79EC45FE1D')],
        ['reference read', (json.reference_number || '').replace(/\D/g, '').startsWith('5514703362026090100061531')],
        // The handle is what actually links a within-HDFC transfer to its bank line.
        ['transfer note read', /aayam2onyxprint/i.test(json.transfer_note || '')],
        ['transfer note is not the payee', !/^onyx/i.test(json.transfer_note || 'x')],
    ];
    console.log('');
    let failed = 0;
    for (const [name, ok] of checks) {
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
        if (!ok) failed++;
    }
    process.exit(failed ? 1 : 0);
}
