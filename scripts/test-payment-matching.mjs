// Deterministic tests for the payment-capture matcher.
//
//   node scripts/test-payment-matching.mjs
//
// Covers everything in lib/payment-capture.ts that decides where money is
// recorded — reference normalising, vendor guessing, bank matching, duplicate
// detection. The AI half (reading the picture) is tested separately by
// scripts/test-payment-capture.mjs, which needs an API key; this file needs
// nothing and should stay that way, because these are the rules that must
// never quietly change.
//
// The cases that matter most are the negative ones: two identical bank lines
// must match NEITHER, an inflow must never prove a payment out, and a capture
// with no reference number must never be guessed into a duplicate.

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Compiled INSIDE node_modules on purpose: from a system temp dir the compiled
// file cannot resolve '@anthropic-ai/sdk', and the import fails before a single
// assertion runs. node_modules is already git-ignored.
const out = path.resolve('node_modules/.cache/aayam-payment-test');
mkdirSync(out, { recursive: true });
{
    execFileSync('npx', ['tsc', 'lib/payment-capture.ts', '--outDir', out,
        '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node',
        '--skipLibCheck', '--esModuleInterop'], { stdio: 'inherit' });

    const require_ = createRequire(import.meta.url);
    const { normalizeRef, guessVendors, guessClients, guessInvoices, matchCaptureToBank, findExistingCapture } =
        require_(path.join(out, 'payment-capture.js'));


    let fail = 0;
    const t = (name, ok) => { console.log((ok?'PASS':'FAIL')+'  '+name); if(!ok) fail++; };

    // ── normalizeRef ─────────────────────────────────────────────────────────
    t('ref: spaces and case ignored',
      normalizeRef('5514 7033 6202') === normalizeRef('551470336202'));
    t('ref: real HDFC reference survives',
      normalizeRef('5514703362026090100061531 0830') === '55147033620260901000615310830');
    t('ref: alphanumeric txn id kept',
      normalizeRef('HDFC9A79EC45FE1D') === 'HDFC9A79EC45FE1D');
    t('ref: too short is rejected (a stray "12" must not match everything)',
      normalizeRef('12') === null);
    t('ref: null in, null out', normalizeRef(null) === null);

    // ── guessVendors ─────────────────────────────────────────────────────────
    const vendors = [
      { id: 'v1', name: 'Onyx Print', company: 'Onyx Print Pvt Ltd' },
      { id: 'v2', name: 'Onyx Papers', company: null },
      { id: 'v3', name: 'Shreeji Packaging', company: 'Shreeji Packaging LLP' },
      { id: 'v4', name: 'Rainbow Inks', company: null },
    ];
    const g = guessVendors('Onyx print', vendors);
    t('vendor: exact-ish name ranks first', g.length > 0 && g[0].id === 'v1');
    t('vendor: unrelated vendors excluded', !g.some(x => x.id === 'v4'));
    t('vendor: legal suffix ignored',
      guessVendors('Shreeji Packaging Pvt Ltd', vendors)[0]?.id === 'v3');
    t('vendor: no payee → no guess', guessVendors(null, vendors).length === 0);
    t('vendor: gibberish payee → no guess',
      guessVendors('QQQQ ZZZZ', vendors).length === 0);
    t('vendor: at most 3 suggestions', guessVendors('Onyx', vendors).length <= 3);

    // ── matchCaptureToBank ───────────────────────────────────────────────────
    // NOTE ON DIRECTION: in Zoho's bank feed, credit = money OUT (vendor
    // payments, expenses) and debit = money IN (customer payments). These
    // cases exist because reading it the intuitive way would have matched our
    // payment screenshots against incoming customer money.
    // Stands in for PostgREST. `.or()` is applied for real, because
    // findExistingCapture now depends on the DATABASE to filter by the
    // normalised reference keys — a mock that ignored it would report every
    // payment as a duplicate of the first row and the tests would prove nothing.
    function db(rows) {
      let orFilter = null;
      const q = {
        select: () => q, gte: () => q, lte: () => q, gt: () => q, lt: () => q,
        eq: () => q, in: () => q, is: () => q, not: () => q,
        limit: () => q, order: () => q, neq: () => q, maybeSingle: () => q,
        or: (f) => { orFilter = f; return q; },
        then: (r) => {
          let out = rows;
          if (orFilter) {
            // "reference_key.eq.ABC,transaction_key.eq.DEF" — the generated
            // columns Postgres computes; recreated here the same way.
            const wanted = orFilter.split(',').map((c) => c.split('.eq.')[1]);
            const key = (v) => (v ? String(v).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null);
            out = rows.filter((row) =>
              wanted.includes(key(row.reference_number)) || wanted.includes(key(row.transaction_id))
            );
          }
          return r({ data: out, error: null });
        },
      };
      return { from: () => q };
    }
    const cap = {
      id: 'c1', amount: 22700, txn_date: '2026-09-01',
      reference_number: '5514703362026090100061531 0830',
      transaction_id: 'HDFC9A79EC45FE1D',
      transfer_note: 'aayam2onyxprint',
      paid_to: 'Onyx print',
      paid_from: 'AAYAM COMMUNICATION',
      direction: 'out',
      needs_bank_match: true,
    };
    const OUT = { debit_or_credit: 'credit', transaction_type: 'vendor_payment' };
    const IN  = { debit_or_credit: 'debit',  transaction_type: 'customer_payment' };

    await (async () => {
      // Tier 1 — the receipt's reference appears in the bank line.
      let r = await matchCaptureToBank(db([
        { id: 'b1', ...OUT, amount: 22700, txn_date: '2026-09-02',
          reference_number: '55147033620260901000615310830', description: 'NEFT DR ONYX', payee: 'ONYX PRINT' },
        { id: 'b2', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: 'HDFCH01199999999', description: 'someone else', payee: 'OTHER' },
      ]), cap);
      t('match: reference beats a same-amount decoy',
        r && r.zoho_bank_transaction_id === 'b1' && r.match_method === 'reference');

      // Tier 2 — the real HDFC case: references differ, the handle is echoed.
      r = await matchCaptureToBank(db([
        { id: 'b3', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: 'xxxxxxxxxxxx9803', description: 'XXXXXXXXXXX622-TPT-AAYAM2ONYXPRINT-ONYX PRINTS', payee: null },
        { id: 'b4', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: 'xxxxxxxxxxxx1111', description: 'TPT-AAYAM2PUNIT-PUNIT PAPERS', payee: null },
      ]), cap);
      t('match: transfer handle separates two same-amount transfers',
        r && r.zoho_bank_transaction_id === 'b3' && r.match_method === 'transfer_note');

      // A reference identifies the transfer; the amount is read off a photo.
      // Gating the reference tier on the amount made a 50-paise misread report
      // a completed payment as one the bank never confirmed.
      r = await matchCaptureToBank(db([
        { id: 'bp', ...OUT, amount: 22700.50, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'NEFT DR ONYX', payee: 'ONYX PRINT' },
      ]), cap);
      t('match: reference still matches when the amount was read slightly wrong',
        r && r.zoho_bank_transaction_id === 'bp' && r.match_method === 'reference');

      // A reference on two lines (the payment, plus a bank charge booked against
      // the same UTR) is ambiguous, so the reference tier declines and the
      // weaker tiers decide — landing on the line whose amount AND payee agree,
      // never on the ₹500 charge.
      r = await matchCaptureToBank(db([
        { id: 'bq1', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'NEFT DR', payee: 'ONYX' },
        { id: 'bq2', ...OUT, amount: 500, txn_date: '2026-09-01',
          reference_number: null, description: 'CHG 55147033620260901000615310830', payee: null },
      ]), cap);
      t('match: a shared reference falls through to the line that actually fits',
        r && r.zoho_bank_transaction_id === 'bq1' && r.match_method !== 'reference');

      // And when the weaker tiers cannot separate them either, nothing matches.
      r = await matchCaptureToBank(db([
        { id: 'br1', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'NEFT DR', payee: null },
        { id: 'br2', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'REVERSAL', payee: null },
      ]), { ...cap, transfer_note: null, paid_to: null });
      t('match: a duplicated reference with nothing to separate it matches NEITHER', r === null);

      // Most feed references are masked ('xxxxxxxxxxxx9803'). Such a line may
      // still be matched — but only by the WEAK amount+date tier, never claimed
      // as a reference match, which would overstate the evidence.
      r = await matchCaptureToBank(db([
        { id: 'b5', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: 'xxxxxxxxxxxx9803', description: 'unrelated', payee: null },
      ]), { ...cap, transfer_note: null, paid_to: null });
      t('match: a masked feed reference is never reported as a reference match',
        r !== null && r.match_method === 'amount_date');

      // Tier 3 — payee agrees.
      r = await matchCaptureToBank(db([
        { id: 'b6', ...OUT, amount: 22700, txn_date: '2026-09-01', reference_number: null,
          description: 'NEFT DR-ICIC-ONYX PRINT-NETBANK', payee: 'ONYX PRINT' },
        { id: 'b7', ...OUT, amount: 22700, txn_date: '2026-09-01', reference_number: null,
          description: 'NEFT DR-KKBK-KOTHARI PAPER', payee: 'KOTHARI PAPER CORPORATION' },
      ]), { ...cap, reference_number: null, transaction_id: null, transfer_note: null });
      t('match: payee separates two same-amount payments',
        r && r.zoho_bank_transaction_id === 'b6' && r.match_method === 'payee_amount');

      // Tier 4 — nothing but amount and date, and only one candidate.
      r = await matchCaptureToBank(db([
        { id: 'b8', ...OUT, amount: 22700, txn_date: '2026-09-01', reference_number: null, description: 'NEFT DR', payee: null },
      ]), { ...cap, reference_number: null, transaction_id: null, transfer_note: null, paid_to: null });
      t('match: falls back to amount+date when alone',
        r && r.zoho_bank_transaction_id === 'b8' && r.match_method === 'amount_date');

      // The dangerous case: two indistinguishable candidates.
      r = await matchCaptureToBank(db([
        { id: 'b9',  ...OUT, amount: 22700, txn_date: '2026-09-01', reference_number: null, description: 'x', payee: null },
        { id: 'b10', ...OUT, amount: 22700, txn_date: '2026-09-01', reference_number: null, description: 'y', payee: null },
      ]), { ...cap, reference_number: null, transaction_id: null, transfer_note: null, paid_to: null });
      t('match: TWO identical candidates match NEITHER (no coin-flip)', r === null);

      // Direction: a Zoho DEBIT is money IN and can never prove a payment out.
      r = await matchCaptureToBank(db([
        { id: 'b11', ...IN, amount: 22700, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'NEFT CR customer', payee: 'A CLIENT' },
      ]), cap);
      t('match: an incoming customer payment never proves a payment out', r === null);

      // Wrong amount.
      r = await matchCaptureToBank(db([
        { id: 'b12', ...OUT, amount: 22701, txn_date: '2026-09-01', reference_number: null, description: 'x', payee: null },
      ]), { ...cap, reference_number: null, transaction_id: null, transfer_note: null, paid_to: null });
      t('match: ₹1 off is not a match', r === null);

      t('match: nothing in the window → no match', (await matchCaptureToBank(db([]), cap)) === null);

      r = await matchCaptureToBank(db([
        { id: 'b13', ...OUT, amount: 22700, txn_date: '2026-09-01', reference_number: null, description: 'x', payee: null },
      ]), { ...cap, amount: null });
      t('match: unreadable amount → no match', r === null);
    })();

    // ── DIRECTION: money received ────────────────────────────────────────────
    // Modelled on the real Kotak receipt: Aryadev Chemicals → Aayam
    // Communication, ₹1,00,000, txn KKBKH26243885885, no reference number.
    await (async () => {
      const incoming = {
        id: 'c2', amount: 100000, txn_date: '2026-08-31',
        reference_number: null, transaction_id: 'KKBKH26243885885',
        transfer_note: null,
        paid_to: 'Aayam Communication',
        paid_from: 'Aryadev Chemicals',
        direction: 'in', needs_bank_match: true,
      };

      // A Zoho DEBIT is money in — the side an incoming payment must match.
      let r = await matchCaptureToBank(db([
        { id: 'in1', ...IN, amount: 100000, txn_date: '2026-08-31',
          reference_number: 'KKBKH26243885885', description: 'NEFT CR-ARYADEV CHEMICALS', payee: 'ARYADEV CHEMICALS' },
      ]), incoming);
      t('incoming: matches a DEBIT row by transaction id',
        r && r.zoho_bank_transaction_id === 'in1' && r.match_method === 'reference');

      // The outgoing side must be invisible to it, even at the same amount.
      r = await matchCaptureToBank(db([
        { id: 'out1', ...OUT, amount: 100000, txn_date: '2026-08-31',
          reference_number: 'KKBKH26243885885', description: 'NEFT DR', payee: 'SOMEONE' },
      ]), incoming);
      t('incoming: never matches a payment we made', r === null);

      // And the reverse: our outgoing payment must ignore incoming money.
      r = await matchCaptureToBank(db([
        { id: 'in2', ...IN, amount: 22700, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'NEFT CR', payee: 'A CLIENT' },
      ]), cap);
      t('outgoing: never matches money we received', r === null);

      // On an incoming payment the counterparty is the SENDER. If the payee tier
      // used paid_to it would compare our OWN name against every bank line and
      // match the first one it saw.
      r = await matchCaptureToBank(db([
        { id: 'in3', ...IN, amount: 100000, txn_date: '2026-08-31', reference_number: null,
          description: 'NEFT CR-ARYADEV CHEMICALS-AAYAM COMMUNICATION', payee: 'ARYADEV CHEMICALS' },
        { id: 'in4', ...IN, amount: 100000, txn_date: '2026-08-31', reference_number: null,
          description: 'NEFT CR-MEDHINI AGRITECH-AAYAM COMMUNICATION', payee: 'MEDHINI AGRITECH' },
      ]), { ...incoming, transaction_id: null });
      t('incoming: sender separates two same-amount receipts',
        r && r.zoho_bank_transaction_id === 'in3' && r.match_method === 'payee_amount');
    })();

    // ── CASH ─────────────────────────────────────────────────────────────────
    await (async () => {
      // A cash payment must never be matched, however tempting the candidate:
      // a same-amount bank line on the same day is a DIFFERENT payment.
      const cash = { ...cap, id: 'c3', needs_bank_match: false };
      const r = await matchCaptureToBank(db([
        { id: 'b99', ...OUT, amount: 22700, txn_date: '2026-09-01',
          reference_number: '55147033620260901000615310830', description: 'NEFT DR ONYX', payee: 'ONYX PRINT' },
      ]), cash);
      t('cash: never matched to a bank line, even an exact reference hit', r === null);
    })();

    // ── Client + invoice suggestion ──────────────────────────────────────────
    await (async () => {
      const clients = [
        { id: 'cl1', name: 'Aryadev Chemicals', company: 'Aryadev Chemicals Pvt Ltd' },
        { id: 'cl2', name: 'Medhini Agritech', company: null },
      ];
      const g = guessClients('ARYADEV CHEMICALS', clients);
      t('client: matched from the sender name on the receipt', g.length > 0 && g[0].id === 'cl1');
      t('client: our own name suggests nobody', guessClients('Aayam Communication', clients).length === 0);

      const invoices = (rows) => db(rows);
      // Exact balance → proposed.
      let inv = await guessInvoices(invoices([
        { id: 'i1', doc_number: 'INV-1', doc_date: '2026-08-01', balance: 100000, total: 100000, customer_name: 'Aryadev Chemicals', status: 'sent' },
        { id: 'i2', doc_number: 'INV-2', doc_date: '2026-08-02', balance: 55000, total: 55000, customer_name: 'Aryadev Chemicals', status: 'sent' },
      ]), 'Aryadev Chemicals', 100000);
      t('invoice: an exact balance match is proposed',
        inv.length === 1 && inv[0].doc_number === 'INV-1');

      // Two open invoices, no exact fit → propose nothing rather than a coin-flip.
      inv = await guessInvoices(invoices([
        { id: 'i3', doc_number: 'INV-3', doc_date: '2026-08-01', balance: 90000, total: 90000, customer_name: 'Aryadev Chemicals', status: 'sent' },
        { id: 'i4', doc_number: 'INV-4', doc_date: '2026-08-02', balance: 80000, total: 80000, customer_name: 'Aryadev Chemicals', status: 'sent' },
      ]), 'Aryadev Chemicals', 50000);
      t('invoice: a part payment across several invoices proposes NOTHING', inv.length === 0);

      // Their only open invoice → proposed, and labelled as a part payment.
      inv = await guessInvoices(invoices([
        { id: 'i5', doc_number: 'INV-5', doc_date: '2026-08-01', balance: 150000, total: 150000, customer_name: 'Aryadev Chemicals Pvt Ltd', status: 'sent' },
      ]), 'Aryadev Chemicals', 100000);
      t('invoice: the only open invoice is proposed as a part payment',
        inv.length === 1 && inv[0].reason.includes('part payment'));

      // Another client's invoice is never offered.
      inv = await guessInvoices(invoices([
        { id: 'i6', doc_number: 'INV-6', doc_date: '2026-08-01', balance: 100000, total: 100000, customer_name: 'Medhini Agritech', status: 'sent' },
      ]), 'Aryadev Chemicals', 100000);
      t("invoice: another client's invoice is never offered", inv.length === 0);
    })();

    await (async () => {
      // ── findExistingCapture (duplicate detection) ──────────────────────────
      const existing = [
        { id: 'old', status: 'verified', reference_number: '5514703362026090100061531 0830', transaction_id: 'HDFC9A79EC45FE1D' },
      ];
      let d = await findExistingCapture(db(existing), cap, 'c1');
      t('dupe: same reference → duplicate of the earlier capture', d && d.id === 'old');

      d = await findExistingCapture(db(existing), { reference_number: '999888777666', transaction_id: 'ZZZZ1111' }, 'c1');
      t('dupe: different payment → not a duplicate', d === null);

      d = await findExistingCapture(db(existing), { reference_number: null, transaction_id: null }, 'c1');
      t('dupe: no reference read → never guesses a duplicate', d === null);

      d = await findExistingCapture(db(existing), cap, 'old');
      t('dupe: a capture is never a duplicate of itself', d === null);

      // The commonest real duplicate: the SAME receipt read twice, with the
      // model spacing the reference differently. Matching raw strings missed it.
      d = await findExistingCapture(db(existing), {
        reference_number: '5514703362026090100061531 0830',
        transaction_id: null,
      }, 'c1');
      t('dupe: same reference spaced differently is still a duplicate', d && d.id === 'old');
      d = await findExistingCapture(db([
        { id: 'old2', status: 'pending', reference_number: '55147033620260901000615310830', transaction_id: null },
      ]), { reference_number: '5514 7033 6202 6090 1000 6153 1083 0', transaction_id: null }, 'c1');
      t('dupe: normalising works in both directions', d && d.id === 'old2');

      console.log('');
      console.log(fail ? `${fail} FAILED` : 'all passed');
      process.exitCode = fail ? 1 : 0;
    })();

}
