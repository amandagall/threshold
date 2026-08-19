// api/return-witness.js
//
// TH-47: Build return witness AI logic — arc reflection, new questions, per-answer witnessing
//
// Covers parts (a) and (b) of the ticket. Part (c) — witnessing each of the 3 new typed
// return answers — needs NO new code: it reuses the existing /api/witness endpoint
// unchanged, called from TH-48's return page the same way answer.html already calls it
// for the original 12 questions ("anything someone writes should be witnessed" — same
// mechanism everywhere, not a special case for the return round).
//
// NOTE FOR AMANDA: same caveat as TH-46 — I haven't seen the real source of
// api/witness.js, only its documented behavior (trigger, model, persona description,
// failure handling). I've matched that pattern as closely as I can for consistency, but
// please sanity-check this against the real witness.js before trusting it blind,
// especially the Anthropic request shape.
//
// Design decision (confirmed with Amanda, Aug 19 2026): ONE combined Anthropic call for
// both the arc reflection (beat 4) and the 3 new questions (beat 5), not two separate
// calls. Cheaper, and it means the questions are generated with the arc reflection's own
// read on the year already in view, so they build on it instead of risking a disconnected
// second pass. Trade-off: TH-48 can't show the arc reflection and questions as two
// separate loading/reveal beats if it wants the questions to reflect the SAME arc text
// shown to the user — they arrive together. Worth knowing when TH-48 designs that pacing.
//
// Stateless by design, matching witness.js: this endpoint does no Supabase reads or
// writes. It takes the full letter content in the request body and returns generated
// text; TH-48's return page is responsible for persisting arc_reflection and
// return_question_1-3 via update_signup_by_token, the same separation of concerns
// witness.js already has with answer.html.
//
// IMPORTANT — failure handling is deliberately NOT "silent skip" like witness.js.
// witness.js can fail silently because a missing per-question reflection just means the
// user goes straight to the sealed view — a small, recoverable loss. Here, a failure
// means there's no arc reflection and no questions at all, which blocks beats 4-6 of the
// ceremony entirely. TH-48 needs to treat a failure from this endpoint as a real error
// (show a retry, don't silently continue) rather than copying witness.js's degrade-quietly
// behavior.
//
// Expected request body — TH-48 needs to assemble this from the signup row (already has
// answer_1-12 via get_signup_by_token) plus the original question text for each of the
// 12 questions. I don't know where that question text currently lives in the codebase
// (Documentation's Open Items flags answer.html as not fully documented on this point) —
// find wherever room.html/answer.html source the question copy from and reuse it here.
//
// {
//   "letters": [
//     { "label": "The Before",      "questions": ["...q1", "...q2", "...q3", "...q4"], "answers": ["...a1", "...a2", "...a3", "...a4"] },
//     { "label": "The In Between",  "questions": [...], "answers": [...] },
//     { "label": "The Arrival",     "questions": [...], "answers": [...] }
//   ]
// }
//
// Response:
// { "arc_reflection": "...", "questions": ["...", "...", "..."] }

const SYSTEM_PROMPT = `You are the Threshold Witness. You have just read all three letters someone wrote to themselves over the year leading up to and following a major life transition (retirement) — The Before, The In Between, and The Arrival — along with their answers to every question. A year has now passed and they are returning to open their capsule.

You have two jobs, in order.

FIRST: notice the arc. Not what happened in any single letter — the shape of the movement across all three, read together. What changed. What stayed. What surprised. Write this as 4 to 8 sentences of plain, warm, non-clinical prose. Never start the sentence with "I." No lists, no headers, no bullet points. Do not summarize what they said back to them — reflect what you see in the movement itself, the way someone who has read all three letters closely would notice something the writer may not have named for themselves. Do not ask a question in this part.

SECOND: write exactly 3 short reflection questions for them to answer now, a year later. These must be personalized — built from specific things they actually wrote across the letters, never generic or interchangeable with another user's questions. Approach from a side door, not a front door: specific and embodied lands harder than broad and conceptual. A good question drops them into a moment or a physical detail from their own letters, not an abstract theme ("What did you do the first morning you didn't set an alarm?" beats "How do you feel about your new routine?"). Do not just re-ask something the arc reflection already covered.

Respond in exactly this format and nothing else — no preamble, no closing remarks, no markdown:

ARC:
<the arc reflection>

QUESTION 1:
<question text>

QUESTION 2:
<question text>

QUESTION 3:
<question text>`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Missing ANTHROPIC_API_KEY');
      return res.status(500).json({ error: 'Missing required environment variable' });
    }

    const { letters } = req.body || {};
    if (!Array.isArray(letters) || letters.length !== 3) {
      return res.status(400).json({ error: 'Expected `letters`: an array of 3 letters, each with questions and answers.' });
    }

    const userContent = letters
      .map((letter) => {
        const qas = (letter.questions || [])
          .map((q, i) => `Q: ${q}\nA: ${(letter.answers || [])[i] ?? '(no answer)'}`)
          .join('\n\n');
        return `--- ${letter.label} ---\n${qas}`;
      })
      .join('\n\n');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 900, // higher than witness.js's 400 — this generates 4 pieces of text, not 1
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Failed to generate return witness content' });
    }

    const data = await anthropicRes.json();
    const rawText = data?.content?.[0]?.text;

    if (!rawText) {
      console.error('Anthropic response had no text content:', JSON.stringify(data));
      return res.status(502).json({ error: 'Empty response from Anthropic' });
    }

    const parsed = parseResponse(rawText);
    if (!parsed) {
      // Deliberately NOT falling back to something silently broken — see failure
      // handling note above. TH-48 should surface this as a real error.
      console.error('Failed to parse Anthropic response into expected format:', rawText);
      return res.status(502).json({ error: 'Unexpected response format', raw: rawText });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('return-witness fatal error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

function parseResponse(text) {
  const arcMatch = text.match(/ARC:\s*([\s\S]*?)\s*QUESTION 1:/i);
  const q1Match = text.match(/QUESTION 1:\s*([\s\S]*?)\s*QUESTION 2:/i);
  const q2Match = text.match(/QUESTION 2:\s*([\s\S]*?)\s*QUESTION 3:/i);
  const q3Match = text.match(/QUESTION 3:\s*([\s\S]*)/i);

  if (!arcMatch || !q1Match || !q2Match || !q3Match) {
    return null;
  }

  return {
    arc_reflection: arcMatch[1].trim(),
    questions: [q1Match[1].trim(), q2Match[1].trim(), q3Match[1].trim()],
  };
}