-- ═══════════════════════════════════════════════════════════════════════════
-- PAYMENT CAPTURES — payments posted in the Telegram payments group
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mirrors the LIVE table as of 2026-09-01. Safe to re-run.
--
-- WHY THIS TABLE EXISTS, AND WHY IT IS NOT THE LEDGER
--
-- A bank screenshot is a NOTIFICATION, not proof that money moved. HDFC's own
-- receipt says "Request Accepted" — a request can still fail or reverse. So a
-- capture never writes to a ledger, never writes to Zoho, and never creates a
-- vendor_payment on its own. It is an INBOX.
--
-- The truth arrives on its own: app/api/cron/zoho-bank-sync pulls the HDFC feed
-- out of Zoho Books into ZOHO_BANK_TRANSACTIONS twice a day. (Not
-- bank_transactions — that is the older manually-imported table, stale since
-- 2026-07-14. Matching against it would confirm nothing, forever.)
--
-- Two properties of that feed are counter-intuitive enough to state plainly:
--   · debit  = money IN  (customer payments)
--   · credit = money OUT (vendor payments, expenses, card payments)
-- So a screenshot of a payment WE made must match a CREDIT row, and a client's
-- payment to us must match a DEBIT row.
--
-- A capture's job is to arrive a day EARLIER than the feed, carrying the
-- context the bank line will never have — which vendor or client, which bill,
-- who approved it — and then to be MATCHED against that line.
--
-- The two exception lists that fall out of this are worth more than the saved
-- typing: a screenshot with no bank line after 3 days (the payment may have
-- failed), and a bank outflow with no screenshot (money left unannounced).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Where it came from ────────────────────────────────────────────────
    source                TEXT NOT NULL DEFAULT 'telegram',
    telegram_chat_id      TEXT,
    telegram_message_id   BIGINT,
    telegram_file_id      TEXT,
    posted_by_profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    posted_by_label       TEXT,          -- Telegram display name when unmatched
    image_url             TEXT,
    image_path            TEXT,          -- path inside the payment-proofs bucket
    -- Not every payment has a receipt to photograph. Cash is usually just typed
    -- into the group ("paid 5000 cash to Ramesh for auto").
    entry_kind            TEXT NOT NULL DEFAULT 'screenshot'
                          CHECK (entry_kind IN ('screenshot', 'text')),
    raw_text              TEXT,

    -- ── What Claude read off the screenshot or the message ────────────────
    -- Every one of these is NULLABLE on purpose. A blurry crop that yields only
    -- an amount is still worth keeping: a human can finish it.
    amount                NUMERIC(15,2),
    currency              TEXT DEFAULT 'INR',
    paid_to               TEXT,          -- payee as printed
    paid_from             TEXT,          -- remitter as printed
    txn_date              DATE,
    bank_name             TEXT,
    transaction_id        TEXT,
    reference_number      TEXT,
    payment_method        TEXT,
    -- The receipt's own wording, VERBATIM ("Request Accepted", "Successful",
    -- "Processing"). Never normalised: the difference between accepted and
    -- successful is exactly the difference this table exists to respect.
    gateway_status        TEXT,
    -- The transfer nickname printed on HDFC receipts ("aayam2onyxprint"). The
    -- bank echoes it inside the feed's description ("TPT-AAYAM2ONYXPRINT-..."),
    -- and for a within-HDFC transfer it is often the ONLY thing linking the
    -- two: the receipt's reference number and the feed's are different
    -- identifiers for the same transfer.
    transfer_note         TEXT,
    -- 'out' = we paid someone (matches a Zoho CREDIT row).
    -- 'in'  = someone paid us (matches a Zoho DEBIT row).
    direction             TEXT NOT NULL DEFAULT 'out' CHECK (direction IN ('out', 'in')),
    -- false for cash, which never reaches the bank feed. Without this, every
    -- cash entry would sit forever in the "the bank never confirmed this"
    -- warning list — and a warning list nobody can clear is one nobody reads.
    needs_bank_match      BOOLEAN NOT NULL DEFAULT true,
    extraction_confidence TEXT CHECK (extraction_confidence IN ('high','medium','low')),
    extraction_raw        JSONB,
    extraction_error      TEXT,

    -- ── What a human decided ──────────────────────────────────────────────
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','verified','rejected','duplicate')),
    vendor_id             UUID REFERENCES vendors(id) ON DELETE SET NULL,
    client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
    purchase_bill_id      UUID REFERENCES purchase_bills(id) ON DELETE SET NULL,
    zoho_document_id      UUID REFERENCES zoho_documents(id) ON DELETE SET NULL,
    duplicate_of_id       UUID REFERENCES payment_captures(id) ON DELETE SET NULL,
    notes                 TEXT,
    confirmed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    confirmed_at          TIMESTAMPTZ,
    -- What the bot offered in the group, as [{kind, id, label}]. Buttons carry
    -- an INDEX into this, because Telegram caps callback_data at 64 bytes and
    -- two UUIDs is 77 — which Telegram rejects by dropping the whole message.
    offered_choices       JSONB,
    -- Bumped whenever offered_choices is replaced. A button carries the
    -- revision it was drawn from, so a tap on a stale keyboard is refused
    -- rather than resolving its index against a different list.
    choices_rev           INTEGER NOT NULL DEFAULT 0,

    -- ── What the bank feed confirmed ──────────────────────────────────────
    zoho_bank_transaction_id UUID REFERENCES zoho_bank_transactions(id) ON DELETE SET NULL,
    matched_at            TIMESTAMPTZ,
    -- 'reference' | 'transfer_note' | 'payee_amount' | 'amount_date' | 'manual'
    match_method          TEXT,
    -- Set only when a person presses "Create vendor payment" in the app.
    -- Nothing here does it automatically.
    vendor_payment_id     UUID REFERENCES vendor_payments(id) ON DELETE SET NULL,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columns added after the first release, for a database created from an older
-- copy of this file.
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS entry_kind TEXT NOT NULL DEFAULT 'screenshot';
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS transfer_note TEXT;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'out';
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS needs_bank_match BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS zoho_document_id UUID REFERENCES zoho_documents(id) ON DELETE SET NULL;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS offered_choices JSONB;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS choices_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_captures ADD COLUMN IF NOT EXISTS zoho_bank_transaction_id UUID
    REFERENCES zoho_bank_transactions(id) ON DELETE SET NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────

-- Telegram retries a webhook it thinks failed. Without this, one screenshot
-- becomes three captures and three paid model calls.
CREATE UNIQUE INDEX IF NOT EXISTS payment_captures_telegram_msg_uniq
    ON payment_captures (telegram_chat_id, telegram_message_id)
    WHERE telegram_chat_id IS NOT NULL AND telegram_message_id IS NOT NULL;

-- ONE bank line proves ONE payment. The application also checks this, but a
-- read-then-write cannot survive the reconcile cron racing a button tap — and
-- once two rows shared the id, the application's own guard failed OPEN.
CREATE UNIQUE INDEX IF NOT EXISTS payment_captures_bank_line_uniq
    ON payment_captures (zoho_bank_transaction_id)
    WHERE zoho_bank_transaction_id IS NOT NULL;

-- Deliberately NOT unique. A misread reference must not be able to block a real
-- payment from being captured; duplicates are detected in code and parked as
-- status='duplicate' with duplicate_of_id set, where a human can undo it.
CREATE INDEX IF NOT EXISTS payment_captures_reference_idx
    ON payment_captures (reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_captures_txn_id_idx
    ON payment_captures (transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_captures_ref_lookup_idx
    ON payment_captures (reference_number) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS payment_captures_txn_lookup_idx
    ON payment_captures (transaction_id) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS payment_captures_status_idx    ON payment_captures (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_captures_vendor_idx    ON payment_captures (vendor_id);
CREATE INDEX IF NOT EXISTS payment_captures_client_idx    ON payment_captures (client_id);
CREATE INDEX IF NOT EXISTS payment_captures_direction_idx ON payment_captures (direction, status);
CREATE INDEX IF NOT EXISTS payment_captures_zoho_txn_idx  ON payment_captures (zoho_bank_transaction_id);
CREATE INDEX IF NOT EXISTS payment_captures_match_idx     ON payment_captures (amount, txn_date)
    WHERE zoho_bank_transaction_id IS NULL AND needs_bank_match;

-- ── updated_at ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_payment_captures_touch()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_captures_touch ON payment_captures;
CREATE TRIGGER payment_captures_touch
    BEFORE UPDATE ON payment_captures
    FOR EACH ROW EXECUTE FUNCTION fn_payment_captures_touch();

-- ── RLS — same finance-staff gate as vendor_payments / bank_transactions ──
-- The Telegram webhook writes with the service role, which bypasses RLS.
ALTER TABLE payment_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_captures_finance_read   ON payment_captures;
DROP POLICY IF EXISTS payment_captures_finance_insert ON payment_captures;
DROP POLICY IF EXISTS payment_captures_finance_update ON payment_captures;
DROP POLICY IF EXISTS payment_captures_finance_delete ON payment_captures;

CREATE POLICY payment_captures_finance_read   ON payment_captures FOR SELECT USING (fn_is_finance_staff());
CREATE POLICY payment_captures_finance_insert ON payment_captures FOR INSERT WITH CHECK (fn_is_finance_staff());
CREATE POLICY payment_captures_finance_update ON payment_captures FOR UPDATE USING (fn_is_finance_staff()) WITH CHECK (fn_is_finance_staff());
CREATE POLICY payment_captures_finance_delete ON payment_captures FOR DELETE USING (fn_is_finance_staff());

COMMENT ON TABLE payment_captures IS
 'Inbox of payments posted in the Telegram payments group, in both directions. NOT a ledger: a capture is only trusted once matched to a zoho_bank_transactions line from the Zoho HDFC feed.';
COMMENT ON COLUMN payment_captures.direction IS
 'out = we paid a vendor (matches a Zoho CREDIT row); in = a client paid us (matches a Zoho DEBIT row).';
COMMENT ON COLUMN payment_captures.needs_bank_match IS
 'false for cash, which never reaches the bank feed and must never be flagged as unconfirmed.';
COMMENT ON COLUMN payment_captures.choices_rev IS
 'Bumped every time offered_choices is replaced. Buttons carry the revision they were built from, so a tap on a stale keyboard is refused rather than misapplied.';
