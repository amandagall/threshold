const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email } = req.body;

  const { data, error } = await resend.emails.send({
    from: 'hello@atthreshold.ca',,
    to: email,
    subject: 'Your time capsule is open.',
    html: `
      <div style="background:#1C1C1A; color:#F2EDE4; font-family:Georgia,serif; max-width:480px; margin:0 auto; padding:3rem 2rem;">
        <p style="color:#C9A96E; font-size:0.8rem; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:2rem;">Threshold</p>
        <h1 style="font-style:italic; font-weight:normal; font-size:1.75rem; margin-bottom:1.5rem;">Welcome, ${name}.</h1>
        <p style="line-height:1.8; color:rgba(242,237,228,0.75); margin-bottom:1.5rem;">Your time capsule is open. Over the coming year, three letters will find you — each one carrying questions worth answering honestly.</p>
        <p style="line-height:1.8; color:rgba(242,237,228,0.75);">Your first letter is almost ready. Watch this inbox.</p>
        <p style="margin-top:3rem; color:#C9A96E; font-size:0.85rem; font-style:italic;">— Threshold</p>
      </div>
    `
  });

  if (error) {
    return res.status(500).json({ error });
  }

  return res.status(200).json({ data });
};