# The 11 security points, explained — and what they mean for *your* app

27 July 2026. Written for Satish, in plain language.

---

## First, the most important thing

That checklist was written for a **public consumer app** — the kind where strangers
sign up, anyone can visit, and thousands of unknown people use it.

**Your app is not that.** It is an internal office tool. There is no signup page.
You create the accounts. Nineteen people use it, and you know all nineteen by name.

That single difference changes the answer to most of these points. Some of them are
critical for you. Several are close to irrelevant. Anyone who tells you "do all 11" is
not looking at your app.

Here is the honest sorting:

| | Point | For your app |
| --- | --- | --- |
| 2 | Row Level Security | **The one that matters. Half done.** |
| 11 | Error messages | Worth a cleanup |
| 3 | Test failure paths | Worth doing, but differently than the post says |
| 6 | Server-side validation | Mostly already right |
| 5 | OWASP / SQL injection / XSS | Already low risk — checked |
| 7 | Data leaks in AI code | Checked. Clean. |
| 1 | Privacy policy | Low, but not zero — see below |
| 4 | Security headers | **Done** (26 July) |
| 8 | API keys in frontend | **Done** (checked today) |
| 9 | Rate limits | **Done** (today) |
| 10 | CAPTCHA + CORS | Not needed |

So: **three done, one big one left, a few small ones worth tidying, and three you can
ignore.** That is a much shorter list than 11.

---

# Point 2 — Row Level Security

### What it means

Your database has a bouncer at the door. Row Level Security is the rulebook you give
the bouncer: *this person may see these rows, that person may not.*

The scary version in the post is "no rules at all" — the bouncer waves everyone in,
including complete strangers from the internet.

### Where you actually stand

**The stranger problem is solved.** All 87 of your tables have RLS switched on, and
there are **zero** rules granting access to `anon` (the "not logged in" identity).
Someone who finds your web address and opens DevTools gets nothing. That is the
frightening scenario in the post, and it does not apply to you.

**The staff problem is not solved.** 78 of your rules say, in effect, *"any logged-in
person may read this."* Not "any admin" — any logged-in person.

So today, all 8 designers, both dispatch staff and both CMYK staff can read:

- every bank transaction
- every invoice and payment received
- every client's rates and payment history
- every vendor payment

They don't *see* it, because the app doesn't show them those screens. But the app's
menus are not a lock. Anyone who opens the browser console on a page they *are* allowed
to see can type one line and query anything.

### What happens if you leave it

The realistic risk is not a hacker. It is an ordinary Tuesday:

- A designer who is leaving copies your full client rate list and takes it to a competitor.
- Someone sees a colleague's salary-adjacent data and it spreads through the office.
- A frustrated employee changes or deletes rows they should never have been able to touch.

None of this requires skill. It requires curiosity and a browser.

### Verdict

**This is the one real gap.** It is also the one that takes actual work, because
tightening the rules can break working screens until each one is tested. That is why I
haven't done it blind.

It comes in two parts:

- **Phase 1 — remove duplicate rules.** `leads` has 8 open rules stacked on it,
  `follow_ups` 7, `vendors` 5. These piled up over months of fixes. In Postgres, if
  *any* rule allows something, it is allowed — so one leftover open rule cancels out
  every strict rule you write afterwards. Removing the duplicates changes *nothing*
  about who can access what today. It is pure groundwork, and it is zero-risk.
- **Phase 2 — lock the finance tables** to admin and finance roles. Real change, needs
  testing screen by screen.

---

# Point 11 — Error messages that don't leak

### What it means

When something goes wrong, the message the user sees should say "Something went wrong,
please try again." It should **not** say *"insert into table `vendor_payments` failed:
column `commission_rate` does not exist."*

The second version hands an attacker a free map of your database — table names, column
names, how things are wired together.

### Where you stand

86 places in your API routes send the raw database error straight to the browser.

### What happens if you leave it

On its own, nothing. Nobody breaks in through an error message. But it removes the
guesswork for someone who *is* poking around — instead of guessing your table names,
they can read them.

### Verdict

Worth a cleanup, low urgency. Log the full error on the server where you can debug it,
show the person something plain. Roughly an hour of work.

---

# Point 3 — Test the failure path, not just the happy path

### What it means

Most bugs hide in what happens when things go *wrong*, not when they go right. The post
suggests: try a wrong password five times, request a reset for an email that doesn't
exist, click a verification link twice.

### Where you stand

**Most of that list doesn't apply to you.** There is no signup form, no email
verification, no self-service password reset — you create accounts yourself. So those
specific tests have nothing to test.

But the *principle* absolutely applies, and you have already been bitten by it. Twice
this month:

- Dispatch boards loaded empty because the page ran before the Supabase session was
  ready, so the database saw "not logged in" and correctly returned zero rows.
- Client saves failed silently because the browser's session had quietly lapsed.

That is exactly this point. Not "wrong password five times" — **"what happens when the
session isn't there yet, or has expired?"**

### What happens if you leave it

You already know: screens that look empty or broken for no visible reason, and hours
lost hunting a bug that isn't a bug.

### Verdict

Worth doing, but rewrite the test list for your app. The useful failure paths are:
session expired mid-work, network drops mid-save, two people editing the same job, a
deploy landing while someone has a tab open.

---

# Point 6 — Client-side validation is UX, not security

### What it means

If your form says "phone number must be 10 digits", that check runs in the browser — and
the browser belongs to the user. Anyone can turn it off and send whatever they like
straight to your server. So the server has to check again.

### Where you stand

Mostly right already. `app/api/crm/clients/route.ts` uses a whitelist — it accepts only
the ~25 fields it expects and silently ignores anything else. That is exactly the correct
pattern, and it is worth copying into other routes.

### What happens if you leave it

Someone could send a badly-shaped record that corrupts a screen or a report. Given that
"someone" is one of your 19 staff, the realistic risk is an accident, not an attack.

### Verdict

Already largely handled. Copy the whitelist pattern outward when you touch other routes.
Not urgent.

---

# Point 5 — OWASP, SQL injection, XSS

### What it means

- **SQL injection** — typing database commands into a form field and having the database
  run them.
- **XSS** — planting JavaScript into a field so it runs in someone else's browser later.

### Where you stand — I checked both

**SQL injection: not reachable.** Everything goes through the Supabase client, which
sends values separately from the query. There is no place where your code glues user text
into a SQL string. This vulnerability essentially cannot occur in your app as written.

**XSS: very low.** I searched for `dangerouslySetInnerHTML` — the main way this gets in —
and there are **zero** uses. React escapes text automatically. Your Content Security
Policy adds another layer.

One honest caveat: your CSP includes `'unsafe-inline'` and `'unsafe-eval'`, which weakens
that second layer. That is normal for a Next.js app and hard to avoid without significant
work, and with no XSS entry point it doesn't matter much today.

### Verdict

Already low risk. No action needed.

---

# Point 7 — AI-written code leaks data in three spots

### What it means

Code generated quickly tends to leak in three ways: secrets ending up in the browser,
API responses returning far more than the screen needs, and secrets printed into logs.

### Where you stand — I checked all three

**Secrets in the browser: clean.** The only `NEXT_PUBLIC_` values are the Supabase URL,
the anon key and the VAPID public key — all three are *meant* to be public.

**Logs: clean.** Your Drive routes log things like `hasAccessToken: true` and
`codeLength: 42` — deliberately the shape of the secret, never the secret. Whoever wrote
that was being careful.

**API responses: mostly clean.** 8 routes use `select('*')`, which returns every column
whether the screen needs it or not. Only one touches anything sensitive
(`designer_attendance`). Minor.

### Verdict

Checked and clean. Tidy the `select('*')` calls when convenient.

---

# Point 1 — Privacy policy and data law

### What it means

Once you hold personal information about people, laws apply about what you may do with
it and how you protect it.

### Where you stand

The post mentions GDPR (Europe) and CCPA (California). **Neither is your main concern.**
You are in India, so the relevant law is the **Digital Personal Data Protection Act,
2023.** If you ever take on European clients, GDPR comes into play too.

What you actually hold: staff names, phone numbers, attendance records and pay-adjacent
data; and client company details, GST numbers, addresses and payment histories.

Most of that is business data, which is treated more lightly. The staff data is genuinely
personal.

### What happens if you leave it

Low practical risk for an internal tool with 19 users. Nobody is auditing you. The more
likely scenario is ordinary: a larger client asks "what do you do with our data and who
can see it?" during onboarding, and you have nothing to hand them.

### Verdict

Low priority, not zero. A one-page internal note — what you collect, where it lives
(Supabase in Mumbai, Google Drive), who can see it, how long you keep it — would take an
hour and covers you for the client question.

**I am not a lawyer and this is not legal advice.** If you sign a client who asks about
data handling in a contract, that is the moment to spend an hour with one.

---

# Point 4 — Security headers — DONE ✅

Small instructions your server sends with every page telling the browser to be strict:
don't let this site be embedded in someone else's page, always use HTTPS, don't guess
file types.

You shipped these on 26 July, and they are genuinely good — a full Content Security
Policy, HSTS with a two-year window, clickjacking blocked, framework version hidden.
Better than most production apps I see. **Nothing to do.**

---

# Point 8 — API keys in the frontend — DONE ✅

Anything sent to the browser is public, permanently. A key in the browser is a key
you've given away.

I checked every one: your Anthropic key, Google client secret, VAPID private key and
Supabase service role key are all server-only. **Nothing to do.**

---

# Point 9 — Rate limits — DONE ✅ (today)

Without a cap, one stuck loop in a browser can call a paid API thousands of times before
anyone notices. The post's example of a bill going from $20 to $200 in a day is real and
common.

You had no limits anywhere. Three of your routes call the paid Anthropic API. As of
today: 10 calls per minute on those three, 30 on Telegram sends, 60 on stage alerts.

One honest limitation: the counter lives in one server's memory, and Vercel may run
several. So the real ceiling is roughly (limit × servers running) rather than an exact
number. That still turns "unlimited" into "bounded", which is the point. If you ever need
it exact, it moves to the database — same code, different storage.

---

# Point 10 — CAPTCHA and CORS — not needed

**CAPTCHA** stops bots filling in public forms. You have no public forms. Your only
public page is `/track/[jobNumber]`, which shows 7 harmless job-status fields. Your login
page is Supabase's, which has its own throttling. Adding CAPTCHA would add friction for
your staff and stop nothing.

**CORS** controls which other websites may call your API. Next.js already blocks
cross-site calls by default, and I found no place where that was loosened.

**Nothing to do.**

---

# If you only do one thing

Do **Point 2, Phase 1** — remove the duplicate open policies.

It changes nothing about how the app behaves today, so it cannot break anything. And
until it's done, every future attempt to lock down your finance data will silently do
nothing, because one leftover open rule overrides all of it.

It is the foundation the real fix sits on.
