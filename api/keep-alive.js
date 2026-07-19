const SUPABASE_URL = 'https://fvdsizuvdaanstgvhkmt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Daily ping to keep the Supabase free-tier project from auto-pausing
// (Supabase pauses free projects after 7 days with no database activity).
// A trivial read is enough to count as activity.
module.exports = async function handler(req, res) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/signups?select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase ping failed: ${response.status}`);
    }

    return res.status(200).json({ ok: true, pinged: new Date().toISOString() });
  } catch (err) {
    console.error('Keep-alive ping failed:', err);
    return res.status(500).json({ error: err.message });
  }
};