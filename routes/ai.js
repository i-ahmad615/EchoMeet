const express = require('express');
const router = express.Router();

const apiKey = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

const hasValidApiKey = apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE' && apiKey !== '';

if (hasValidApiKey) {
    console.log('✅ Gemini API is ready for translation and chatbot via Direct URL');
} else {
    console.log('⚠️ Gemini API key not configured. Using fallback responses.');
}

// Helper function to call the direct Gemini REST API
async function generateFromGemini(prompt) {
    const fetchUrl = `${GEMINI_API_URL}?key=${apiKey}`;
    const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Google API Error: ${errorData}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}

// Translation endpoint - English ↔ Roman Urdu
router.post('/translate', async (req, res) => {
    try {
        const { message, targetLanguage } = req.body;
        
        // Agar API key nahi hai, toh fallback logic use karein
        if (!hasValidApiKey) {
            let translation = message;
            if (targetLanguage === 'Roman Urdu' && /[a-zA-Z]/.test(message)) {
                const simpleTranslations = {
                    'hello': 'assalam-o-alaikum',
                    'how are you': 'aap kaise hain',
                    'good': 'acha',
                    'thank you': 'shukriya',
                    'love': 'mohabbat',
                    'yes': 'haan',
                    'no': 'nahi',
                    'ok': 'theek hai'
                };
                const lowerMsg = message.toLowerCase();
                for (const [eng, urdu] of Object.entries(simpleTranslations)) {
                    if (lowerMsg.includes(eng)) {
                        translation = urdu;
                        break;
                    }
                }
            } else if (targetLanguage === 'English') {
                const urduToEng = {
                    'assalam-o-alaikum': 'Hello',
                    'aap kaise hain': 'How are you',
                    'acha': 'Good',
                    'shukriya': 'Thank you',
                    'mohabbat': 'Love',
                    'haan': 'Yes',
                    'nahi': 'No',
                    'theek hai': 'OK'
                };
                const lowerMsg = message.toLowerCase();
                for (const [urdu, eng] of Object.entries(urduToEng)) {
                    if (lowerMsg.includes(urdu)) {
                        translation = eng;
                        break;
                    }
                }
            }
            return res.json({ success: true, translation: translation });
        }
        
        let prompt = '';
        if (targetLanguage === 'Roman Urdu') {
            prompt = `Translate the following English text to Roman Urdu (Urdu written in English alphabet). Only return the translation, no explanations. Text: "${message}"`;
        } else if (targetLanguage === 'English') {
            prompt = `Translate the following Roman Urdu text to English. Only return the translation, no explanations. Text: "${message}"`;
        } else {
            prompt = `Translate "${message}" to ${targetLanguage}. Only return translation.`;
        }
        
        // Direct API Call
        const translation = await generateFromGemini(prompt);
        res.json({ success: true, translation });

    } catch (error) {
        console.error('Translation error:', error);
        res.json({ success: false, translation: req.body.message });
    }
});

// Auto-reply/Chatbot endpoint
router.post('/auto-reply', async (req, res) => {
    try {
        const { message } = req.body;
        
        // Agar API key nahi hai, toh fallback replies use karein
        if (!hasValidApiKey) {
            const fallbackReplies = [
                "That's interesting! Tell me more.",
                "I understand. How can I help you with that?",
                "Thanks for sharing! Is there anything specific you'd like to know?",
                "Great! What would you like to do next?",
                "I'm here to help you communicate better."
            ];
            const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
            return res.json({ success: true, reply: randomReply });
        }
        
        const prompt = `You are a helpful assistant for a video chat app. Provide a short, friendly, helpful response to this message. Keep response under 30 words. Message: "${message}"`;
        
        // Direct API Call
        const reply = await generateFromGemini(prompt);
        res.json({ success: true, reply });

    } catch (error) {
        console.error('Auto-reply error:', error);
        res.json({ success: false, reply: "I'm here to help! What would you like to know?" });
    }
});

module.exports = router;