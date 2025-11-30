// routes/chat.js
const express = require('express');
const router  = express.Router();
const { OpenAI } = require('openai');

// On utilise la lib OpenAI, mais en pointant vers Hugging Face Router.
// Donc pas de crédits OpenAI utilisés, seulement ton token HF.
const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL     = process.env.HF_MODEL || 'katanemo/Arch-Router-1.5B:hf-inference'; 
// ↑ modèle d’exemple recommandé dans la doc HF Router (task: chat completion)

if (!HF_API_TOKEN) {
  console.warn('[chat] ⚠️ HF_API_TOKEN manquant. Mets-le dans ton .env pour que l’IA fonctionne.');
}

// Client vers Hugging Face Router (OpenAI-compatible)
const hfClient = new OpenAI({
  apiKey: HF_API_TOKEN,
  baseURL: 'https://router.huggingface.co/v1',
});

/**
 * Handler commun pour /chat et /chat/hugging
 * Body attendu : { question: string, history?: [{role, content}] }
 * Réponse : { answer: string } ou { error: string }
 */
async function handleChat(req, res) {
  try {
    const { question, history = [] } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question est requise.' });
    }

    if (!HF_API_TOKEN) {
      return res.status(500).json({ error: "HF_API_TOKEN manquant côté serveur." });
    }

    // On prépare les messages au format OpenAI/HF Router
    const systemMessage = {
      role: 'system',
      content:
        "Tu es un assistant support pour la plateforme IT Star Academy. " +
        "Réponds en français, de manière claire, concise et pédagogique.",
    };

    // history vient déjà sous la forme [{ role: 'user' | 'assistant', content: '...' }]
    const messages = [
      systemMessage,
      ...history,
      { role: 'user', content: question },
    ];

    const completion = await hfClient.chat.completions.create({
      model: HF_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 256,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      console.error('[chat] Pas de réponse dans completion:', completion);
      return res.status(500).json({ error: 'Réponse vide de la part du modèle.' });
    }

    return res.json({ answer });
  } catch (err) {
    console.error('Erreur /chat HF Router:', err);
    // Essayer de renvoyer un message d’erreur simple au front
    return res.status(500).json({ error: "Impossible de joindre l'IA (HF Router)." });
  }
}

// On expose les deux endpoints :
// - POST /chat         (si un jour tu veux appeler ça directement)
// - POST /chat/hugging (celui que ta vue chat.ejs utilise déjà)
router.post('/', handleChat);
router.post('/hugging', handleChat);

module.exports = router;
