import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

interface OpenAIResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
}

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"] })); // adjust to your frontend origin

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/generate", async (req, res) => {
    try {
        const { prompt, platform, contentType, tone } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Missing prompt" });
        }

        // 1) Generate with OpenAI
        const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a content generator. Platform=${platform}, Type=${contentType}, Tone=${tone}. Keep output concise and actionable.`,
                    },
                    { role: "user", content: prompt },
                ],
                temperature: 0.7,
            }),
        });

        if (!openaiResp.ok) {
            const errText = await openaiResp.text();
            return res.status(502).json({ error: "OpenAI error", details: errText });
        }

        const openaiData = (await openaiResp.json()) as OpenAIResponse;
        const rawText = openaiData?.choices?.[0]?.message?.content?.trim();
        if (!rawText) {
            return res.status(502).json({ error: "No content from OpenAI" });
        }

        // 2) Moderate with Shield Gemma (Hugging Face Inference API)
        const hfResp = await fetch("https://api-inference.huggingface.co/models/google/shield-gemma-2b", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.HF_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: rawText }),
        });

        if (!hfResp.ok) {
            const errText = await hfResp.text();
            return res.status(502).json({ error: "Hugging Face error", details: errText });
        }

        const moderation = await hfResp.json();
        // NOTE: Shape varies by task; commonly returns an array of labels/scores.
        // You should adapt this to the exact model output format.
        const unsafe = JSON.stringify(moderation).toLowerCase().includes("unsafe");

        if (unsafe) {
            return res.status(400).json({ error: "Content flagged by Shield Gemma", moderation });
        }

        // 3) Return safe content
        res.json({
            content: rawText,
            model: "openai:gpt-4o-mini",
            moderation_model: "google/shield-gemma-2b",
            moderation,
        });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: "Server error", details: e?.message });
    }
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
