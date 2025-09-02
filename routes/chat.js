// routes/chat.js
const express = require('express');
const router  = express.Router();
const { OpenAI } = require('openai');   // récupère la classe OpenAI

// Initialise l’API OpenAI avec ta clé (depuis .env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL     = 'openai-community/gpt2 '; // bot de dialogue gratuit

/**
 * POST /api/chat
 * Body : { question: string, history?: [{ role, content }] }
 * Répond : { answer: string }
 */
router.post('/', async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    // Prompt système
    const systemPrompt = {
      role:    'system',
      content: 'Tu es un assistant support pour la plateforme. Réponds précisément aux questions en te basant sur ton savoir.'
    };

    // Assemble la conversation
    const messages = [
      systemPrompt,
      ...history,
      { role: 'user', content: question }
    ];

    // Appel à l’API
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o-mini',  // ou 'gpt-4' si tu y as accès
      messages,
      temperature: 0.2,
      max_tokens:  500
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer });
  } catch (err) {
    console.error('Erreur /api/chat :', err);
    res.status(500).json({ error: 'Impossible de contacter l’IA.' });
  }
});


/**
 * POST /api/chat
 * { question, history }
 */
router.post('/hugging', async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    // On se contente de renvoyer la dernière question pour blenderbot
    const body = { inputs: { text: question } };

    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    if (!hfRes.ok) {
      const err = await hfRes.text();
      console.error('HF error', hfRes.status, err);
      return res.status(500).json({ error: 'Erreur HF : ' + hfRes.status });
    }

    const data = await hfRes.json();
    // HF renvoie [{ generated_text: "..." }]
    const answer = Array.isArray(data) && data[0].generated_text
      ? data[0].generated_text
      : 'Je n’ai pas de réponse pour l’instant.';

    return res.json({ answer });
  } catch (err) {
    console.error('Erreur route /api/chat HF:', err);
    return res.status(500).json({ error: "Impossible de joindre l'IA gratuite." });
  }
});

module.exports = router;
