const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const SUPABASE_URL = 'https://fvdsizuvdaanstgvhkmt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const questions = [
  'What part of yourself do you leave in the car every morning before you walk in?',
  'What would quietly fall apart without you?',
  'Who at work will you actually miss — and does that surprise you?',
  'What are you quietly sad about that you haven\'t fully admitted yet?'
];

async function getEligibleUsers() {
  const today = new Date().toISOString().split('T')[0];

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/signups?current_letter=eq.1&current_question=lt.4&select=*`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const users = await response.json();

  return users.filter(user => {
    if (!user.letter_start_date) return false;
    const start = new Date(`${user.letter_start_date}T12:00:00`);
    const questionNumber = user.current_question;
    const nextSendDate = new Date(start);
    nextSendDate.setDate(nextSendDate.getDate() + (questionNumber * 4));
    return nextSendDate.toISOString().split('T')[0] === today;
  });
}

async function sendQuestionEmail(user, questionIndex) {
  const question = questions[questionIndex];
  const questionNumber = questionIndex + 1;

  const isFirst = questionNumber === 1;

  const intro = isFirst
    ? `A little while ago, with retirement on the horizon, you did something quiet and intentional.\n\nYou opened a time capsule. You told us when you were leaving. And you trusted that something worth saying would find you before you did.\n\nIt has.`
    : `Your next question is waiting.`;

  const { error } = await resend.emails.send({
    from: 'hello@atthreshold.ca',
    to: user.email,
    subject: isFirst ? 'Your first letter is ready.' : `Question ${questionNumber} of 4 is ready.`,
    html: `
      <div style="background:#1C1C1A; color:#F2EDE4; font-family:Georgia,serif; max-width:520px; margin:0 auto; padding:4rem 2.5rem;">
        <p style="color:#C9A96E; font-size:0.75rem; letter-spacing:0.22em; text-transform:uppercase; margin-bottom:3rem;">Threshold</p>
        <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:1.75rem; white-space:pre-line;">${intro}</p>
        <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:1.75rem;">Your first letter is waiting — the first of four questions that will arrive before you walk out that door for the last time. Each one is worth sitting with honestly.</p>
        <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:2.5rem;">When you're ready, it's inside.</p>
        <a href="https://atthreshold.ca/room?token=${user.token}" style="display:inline-block; color:#C9A96E; font-family:'DM Sans',sans-serif; font-size:0.75rem; letter-spacing:0.18em; text-transform:uppercase; text-decoration:none; border:1px solid rgba(201,169,110,0.28); padding:0.9rem 2.5rem;">Open your letter →</a>
        <p style="margin-top:3.5rem; color:rgba(242,237,228,0.3); font-size:0.8rem; font-style:italic;">— Threshold</p>
      </div>
    `
  });

  if (error) {
    console.error(`Failed to send to ${user.email}:`, error);
    return false;
  }

  return true;
}

async function updateUserQuestion(userId, newQuestionNumber) {
  await fetch(`${SUPABASE_URL}/rest/v1/signups?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ current_question: newQuestionNumber })
  });
}

module.exports = async function handler(req, res) {
  try {
    const users = await getEligibleUsers();
    const results = [];

    for (const user of users) {
      const questionIndex = user.current_question;
      const sent = await sendQuestionEmail(user, questionIndex);

      if (sent) {
        await updateUserQuestion(user.id, user.current_question + 1);
        results.push({ email: user.email, question: questionIndex + 1, status: 'sent' });
      } else {
        results.push({ email: user.email, question: questionIndex + 1, status: 'failed' });
      }
    }

    return res.status(200).json({ processed: results.length, results });
  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
};