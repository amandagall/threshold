const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTest() {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'hello@mehker.ca',
    subject: 'Threshold test email',
    html: '<p>It works. Threshold can send emails.</p>'
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sent!', data);
  }
}

sendTest();