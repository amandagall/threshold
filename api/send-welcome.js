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
    html: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#1C1C1A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1C1C1A;">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px; width:100%;">
        <tr>
          <td align="center" style="padding-bottom:40px;">
            <p style="margin:0; color:#C9A96E; font-family:Georgia,serif; font-size:12px; letter-spacing:4px; text-transform:uppercase;">Threshold</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:28px;">
            <p style="margin:0; color:#F2EDE4; font-family:Georgia,serif; font-size:18px; line-height:1.8;">Welcome, ${name.split(' ')[0]}.</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:28px;">
            <p style="margin:0; color:rgba(242,237,228,0.75); font-family:Georgia,serif; font-size:16px; line-height:1.9;">There will be celebrations. Dinners, toasts, people who love you saying the right things.</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:28px;">
            <p style="margin:0; color:rgba(242,237,228,0.75); font-family:Georgia,serif; font-size:16px; line-height:1.9;">Threshold is for the quieter question underneath all of it — <em>who are you, now that this chapter is closing?</em></p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:28px;">
            <p style="margin:0; color:rgba(242,237,228,0.75); font-family:Georgia,serif; font-size:16px; line-height:1.9;">Over the coming year, we'll find you at the moments that matter. Letters will arrive when the time is right, carrying questions worth sitting with honestly. Your answers will be sealed inside your capsule — private, and entirely yours.</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:40px;">
            <p style="margin:0; color:rgba(242,237,228,0.75); font-family:Georgia,serif; font-size:16px; line-height:1.9;">For now, your capsule is open and waiting.</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:56px;">
            <a href="https://atthreshold.ca/room?token=${token}" style="display:inline-block; color:#C9A96E; font-family:Georgia,sans-serif; font-size:12px; letter-spacing:3px; text-transform:uppercase; text-decoration:none; border:1px solid rgba(201,169,110,0.4); padding:14px 40px;">Enter Threshold →</a>
          </td>
        </tr>
        <tr>
          <td>
            <p style="margin:0; color:rgba(242,237,228,0.3); font-family:Georgia,serif; font-size:13px; font-style:italic;">— Threshold</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
  });

  if (error) {
    return res.status(500).json({ error });
  }

  return res.status(200).json({ data });
};