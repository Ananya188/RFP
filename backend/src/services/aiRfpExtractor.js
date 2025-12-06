// services/aiRfpExtractor.js
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You extract RFP details from natural language and return STRICT JSON only.
Match EXACTLY this schema (fields not present should be null or empty):

{
  "title": "",
  "items": [{ "name": "", "quantity": 0, "specs": {} }],
  "totalBudget": null,
  "deliveryDays": null,
  "paymentTerms": null,
  "warrantyMonths": null
}
Return JSON only.
`;

export async function extractRfpAI(text) {
  const response = await client.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract the RFP from this text:\n\n${text}` }
    ],
    max_tokens: 700
  });

  let aiText = response?.choices?.[0]?.message?.content ?? '';
  aiText = aiText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(aiText);
    return parsed;
  } catch (err) {
    console.error('AI parse error:', aiText);
    throw new Error('AI returned invalid JSON');
  }
}

export async function checkOpenAIStatus() {
  try {
    const ping = await client.chat.completions.create({
      model: "gpt-4.1-mini",  // cheaper/faster for testing
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5
    });

    return {
      success: true,
      message: "OpenAI API is working",
      response: ping.choices?.[0]?.message?.content || null
    };
  } catch (error) {
    return {
      success: false,
      message: "OpenAI API NOT working",
      error: error.message
    };
  }
}
