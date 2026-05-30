const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, token } = req.body;

  const { data, error } = await resend.emails.send({
    from: 'Threshold <hello@atthreshold.ca>',
    to: email,
    subject: 'Your time capsule is open.',
    html: `
<div style="background:#1C1C1A; color:#F2EDE4; font-family:Georgia,serif; max-width:520px; margin:0 auto; padding:4rem 2.5rem; text-align:center;">    <p style="color:#C9A96E; font-size:0.75rem; letter-spacing:0.22em; text-transform:uppercase; margin-bottom:3rem;">Threshold</p>
<p style="font-size:1.1rem; line-height:1.8; color:#F2EDE4; margin-bottom:1.75rem;">Welcome, ${name.split(' ')[0]}.</p>    <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:1.75rem;">There will be celebrations. Dinners, toasts, people who love you saying the right things.</p>
    <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:1.75rem;">Threshold is for the quieter question underneath all of it — <em>who are you, now that this chapter is closing?</em></p>
    <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:1.75rem;">Over the coming year, we'll find you at the moments that matter. Letters will arrive when the time is right, carrying questions worth sitting with honestly. Your answers will be sealed inside your capsule — private, and entirely yours.</p>
    <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:2.5rem;">For now, your capsule is open and waiting.</p>
    <a href="https://atthreshold.ca/room?token=${token}" style="display:inline-block; color:#C9A96E; font-family:'DM Sans',sans-serif; font-size:0.75rem; letter-spacing:0.18em; text-transform:uppercase; text-decoration:none; border:1px solid rgba(201,169,110,0.28); padding:0.9rem 2.5rem;">Enter Threshold →</a>
    <p style="margin-top:3.5rem; color:rgba(242,237,228,0.3); font-size:0.8rem; font-style:italic;">— Threshold</p>
  </div>
`
  });

  if (error) {
    return res.status(500).json({ error });
  }

  return res.status(200).json({ data });
};