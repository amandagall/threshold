// api/cron-return-trigger.js
//
// TH-46: Build return-trigger cron + return email
//
// Detects users whose capsule has reached its return date (~1 year post-retirement)
// and sends the "capsule opens" knock email — same knock-on-the-door pattern as
// cron-send-questions.js (quiet, not urgent), but triggers Ceremony Two — The Return
// (see Experience Design Notes, beat 1) instead of the next question.
//
// NOTE FOR AMANDA: I don't have the actual source of cron-send-questions.js or
// send-welcome.js in front of me (no repo access this session) — I've written this
// from the documented behavior (Documentation page: Environment Variables, Routing &
// Cron, Emails sections) and the dependency list in package.json (dotenv + resend only,
// no @supabase/supabase-js — so this talks to Supabase via plain REST/PostgREST, same
// as the rest of the app). Please sanity-check the SUPABASE_URL constant and the Resend
// call shape against your real send-welcome.js before trusting this blind — I've matched
// the documented pattern as closely as I can, but haven't seen the literal bytes.
//
// Eligibility (catch-up safe, decided with Amanda Aug 19 2026 — deliberately NOT the
// exact-date-match pattern cron-send-questions.js uses, because missing this one-time
// event is much costlier than missing a single question):
//   - retirement_date + 1 year <= today   (the capsule's return date has arrived)
//   - current_letter = 4                  (they've actually finished all three letters —
//                                           don't return a capsule before there's anything
//                                           to return; this also means stragglers are
//                                           waited on rather than skipped)
//   - return_triggered_at IS NULL         (never sent before — added in this ticket's
//                                           migration, add_return_triggered_at_column)

const SUPABASE_URL = 'https://fvdsizuvdaanstgvhkmt.supabase.co';

export default async function handler(req, res) {
  try {
    const supabaseKey = process.env.SUPABASE_KEY; // service_role — required to read/write across all rows
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseKey || !resendKey) {
      console.error('Missing SUPABASE_KEY or RESEND_API_KEY');
      return res.status(500).json({ error: 'Missing required environment variables' });
    }

    // "1 year ago" as a plain date — anyone whose retirement_date is on or before this
    // date has, by definition, had their capsule's return date (retirement_date + 1 year)
    // arrive on or before today. Computed in JS rather than in a Postgres expression so
    // this stays a plain REST filter, consistent with how cron-send-questions.js computes
    // its own eligibility dates in JS before querying.
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoDate = oneYearAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    const eligibleUsersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/signups?` +
        `select=id,name,email,token&` +
        `retirement_date=lte.${oneYearAgoDate}&` +
        `current_letter=eq.4&` +
        `return_triggered_at=is.null`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!eligibleUsersRes.ok) {
      const errText = await eligibleUsersRes.text();
      console.error('Failed to fetch eligible users:', errText);
      return res.status(500).json({ error: 'Failed to fetch eligible users' });
    }

    const eligibleUsers = await eligibleUsersRes.json();
    const results = { sent: 0, failed: 0 };

    for (const user of eligibleUsers) {
      try {
        await sendReturnEmail(user, resendKey);

        // Mark as triggered BEFORE moving to the next user, not batched at the end —
        // if the process dies partway through a run, already-sent users don't get
        // double-emailed on the next run. Uses the service_role key directly against
        // the table (like current_letter/letter_N_filed updates in cron-send-questions.js),
        // not the update_signup_by_token RPC — this is a privileged cron write, not a
        // user-initiated one.
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/signups?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ return_triggered_at: new Date().toISOString() }),
        });

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          console.error(`Failed to mark return_triggered_at for user ${user.id}:`, errText);
          results.failed++;
          continue;
        }

        results.sent++;
      } catch (err) {
        console.error(`Failed to process return trigger for user ${user.id}:`, err);
        results.failed++;
      }
    }

    return res.status(200).json({ eligible: eligibleUsers.length, ...results });
  } catch (err) {
    console.error('cron-return-trigger fatal error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function sendReturnEmail(user, resendKey) {
  const returnUrl = `https://atthreshold.ca/return?token=${user.token}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Threshold <hello@atthreshold.ca>',
      to: user.email,
      subject: 'Your capsule is ready to open.',
      html: returnEmailHtml(user.name, returnUrl),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend error for ${user.email}: ${errText}`);
  }
}

// DRAFT COPY — matches the quiet, intimate voice of the Welcome and Question Delivery
// emails in Experience Design Notes, but is NOT locked. Please read this against those
// two before it ships; this is a first pass, not a final.
function returnEmailHtml(name, returnUrl) {
  return `
    <p>${name},</p>
    <p>A year ago, you wrote three letters and sealed them into a capsule you couldn't quite imagine opening again.</p>
    <p>That year has happened now. All of it — the parts you expected, and the parts you didn't.</p>
    <p>Your capsule is back. Everything you wrote is inside, and so is what Threshold saw in you as you wrote it. When you're ready, step back in and meet who you were.</p>
    <p><a href="${returnUrl}">Open your capsule &rarr;</a></p>
    <p>&mdash; Threshold</p>
  `;
}