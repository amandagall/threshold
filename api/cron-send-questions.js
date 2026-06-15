const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const SUPABASE_URL = 'https://fvdsizuvdaanstgvhkmt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const letters = {
  1: {
    name: 'Letter One · Before',
    questions: [
      'What part of yourself do you leave in the car every morning before you walk in?',
      'What would quietly fall apart without you?',
      'Who at work will you actually miss — and does that surprise you?',
      'What are you quietly sad about that you haven\'t fully admitted yet?'
    ],
    emailCopy: [
      {
        subject: 'Your first letter is ready.',
        intro: 'A little while ago, with retirement on the horizon, you did something quiet and intentional.\n\nYou opened a time capsule. You told us when you were leaving. And you trusted that something worth saying would find you before you did.\n\nIt has.',
        body: 'Your first letter is waiting — the first of four questions that will arrive before you walk out that door for the last time. Each one is worth sitting with honestly.',
        cta: 'Open your letter →'
      },
      {
        subject: 'Your second question is ready.',
        intro: 'You showed up for the first one. That matters more than you might think.',
        body: 'The second question is waiting in your capsule. Take it somewhere quiet. There\'s no right answer — only an honest one.',
        cta: 'Continue your letter →'
      },
      {
        subject: 'Your third question is ready.',
        intro: 'Three down, one to go. You\'re almost through the first letter.',
        body: 'This one might be the hardest. Or the easiest. Either way, it\'s waiting for you.',
        cta: 'Continue your letter →'
      },
      {
        subject: 'Your final question is ready.',
        intro: 'This is the last one — the fourth and final question of your first letter.',
        body: 'When you answer this one, your envelope will be sealed. It will wait inside your capsule until you\'re ready to read it — on the other side of the door.',
        cta: 'Answer the final question →'
      }
    ]
  },
  2: {
    name: 'Letter Two · After',
    questions: [
      'What does a good day look like now — and how often does one actually happen?',
      'Is there something you expected to miss that you don\'t? What do you make of that?',
      'What are you doing with the quiet — and is that working?',
      'Is there something you keep meaning to start? What\'s actually in the way?'
    ],
    emailCopy: [
      {
        subject: 'Your second letter has arrived.',
        intro: 'Three months ago, you were standing at the edge of something. Now you\'re on the other side of it.\n\nYour second letter is ready.',
        body: 'This one is about what it actually feels like — not what you expected, but what\'s true now. Take your time with it.',
        cta: 'Open your letter →'
      },
      {
        subject: 'Your second question is ready.',
        intro: 'You showed up for the first one. The second is waiting.',
        body: 'Take it somewhere quiet. There\'s no right answer — only an honest one.',
        cta: 'Continue your letter →'
      },
      {
        subject: 'Your third question is ready.',
        intro: 'Almost through the second letter.',
        body: 'One more after this. Keep going.',
        cta: 'Continue your letter →'
      },
      {
        subject: 'The final question of your second letter.',
        intro: 'This is the last question of Letter Two.',
        body: 'When you answer this one, your second envelope will be sealed and placed in your capsule.',
        cta: 'Answer the final question →'
      }
    ]
  },
  3: {
    name: 'Letter Three · Beyond',
    questions: [
      'What\'s something you used to keep on top of that you\'ve let slide — and how do you actually feel about that?',
      'What small thing has surprised you by making you genuinely happy?',
      'What do you know now about yourself that you couldn\'t have known a year ago?',
      'If the person who wrote Letter One could see you now, what would surprise them most?'
    ],
    emailCopy: [
      {
        subject: 'Your third letter has arrived.',
        intro: 'A year ago, you sealed your first letter. You were standing at a threshold then.\n\nYou\'ve crossed it now.',
        body: 'Your third and final letter is ready. This one is about who you\'ve quietly become.',
        cta: 'Open your letter →'
      },
      {
        subject: 'Your second question is ready.',
        intro: 'The second question of your final letter is waiting.',
        body: 'Take your time with this one.',
        cta: 'Continue your letter →'
      },
      {
        subject: 'Your third question is ready.',
        intro: 'Almost there. One more after this.',
        body: 'Keep going.',
        cta: 'Continue your letter →'
      },
      {
        subject: 'The final question.',
        intro: 'This is the last question — of the last letter.',
        body: 'When you answer this one, your capsule will be complete.',
        cta: 'Answer the final question →'
      }
    ]
  }
};

async function getEligibleUsers() {
  const today = new Date().toISOString().split('T')[0];

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/signups?current_question=lt.4&select=*`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const users = await response.json();

  return users.filter(user => {
    const letter = user.current_letter;
    if (!letter || !letters[letter]) return false;

    if (letter === 1) {
      if (!user.letter_start_date) return false;
      const start = new Date(`${user.letter_start_date}T12:00:00`);
      const nextSendDate = new Date(start);
      nextSendDate.setDate(nextSendDate.getDate() + (user.current_question * 4));
      return nextSendDate.toISOString().split('T')[0] === today;
    }

    if (letter === 2) {
      if (!user.retirement_date) return false;
      const retirement = new Date(`${user.retirement_date}T12:00:00`);
      const letterStart = new Date(retirement);
      letterStart.setMonth(letterStart.getMonth() + 3);
      const nextSendDate = new Date(letterStart);
      nextSendDate.setDate(nextSendDate.getDate() + (user.current_question * 4));
      return nextSendDate.toISOString().split('T')[0] === today;
    }

    if (letter === 3) {
      if (!user.retirement_date) return false;
      const retirement = new Date(`${user.retirement_date}T12:00:00`);
      const letterStart = new Date(retirement);
      letterStart.setFullYear(letterStart.getFullYear() + 1);
      const nextSendDate = new Date(letterStart);
      nextSendDate.setDate(nextSendDate.getDate() + (user.current_question * 4));
      return nextSendDate.toISOString().split('T')[0] === today;
    }

    return false;
  });
}

async function sendQuestionEmail(user, questionIndex) {
  const letter = letters[user.current_letter];
  const copy = letter.emailCopy[questionIndex];

  const { error } = await resend.emails.send({
    from: 'hello@atthreshold.ca',
    to: user.email,
    subject: copy.subject,
    html: `
      <div style="background:#1C1C1A; color:#F2EDE4; font-family:Georgia,serif; max-width:520px; margin:0 auto; padding:4rem 2.5rem;">
        <p style="color:#C9A96E; font-size:0.75rem; letter-spacing:0.22em; text-transform:uppercase; margin-bottom:3rem;">Threshold</p>
        <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:1.75rem; white-space:pre-line;">${copy.intro}</p>
        <p style="font-size:1rem; line-height:1.9; color:rgba(242,237,228,0.75); margin-bottom:2.5rem;">${copy.body}</p>
        <a href="https://atthreshold.ca/answer?token=${user.token}" style="display:inline-block; color:#C9A96E; font-family:'DM Sans',sans-serif; font-size:0.75rem; letter-spacing:0.18em; text-transform:uppercase; text-decoration:none; border:1px solid rgba(201,169,110,0.28); padding:0.9rem 2.5rem;">${copy.cta}</a>
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
        results.push({ email: user.email, letter: user.current_letter, question: questionIndex + 1, status: 'sent' });
      } else {
        results.push({ email: user.email, letter: user.current_letter, question: questionIndex + 1, status: 'failed' });
      }
    }

    return res.status(200).json({ processed: results.length, results });
  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
};