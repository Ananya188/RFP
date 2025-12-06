// services/proposalParserAI.js
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are an assistant that converts vendor replies (email text, HTML, CSV/text attachments, PDF-extracted text, Excel-extracted JSON) into a strict JSON proposal.
Input may include:
- free-form text paragraphs,
- HTML containing <table> elements,
- CSV or JSON attachments (provided as plain text),
- PDF extracted text blocks,
- Excel sheets converted to JSON text blocks.

STRICT RULES:
- RETURN ONLY VALID JSON (no explanations).
- If you see tables or CSVs that look like item rows (columns: item, description, qty, unit price, total), map them to "lineItems".
- Try to detect currency symbols and parse numeric values (remove commas).
- If multiple totals appear, choose the most probable grand total.
- Provide best-effort 'lineItems' array with objects: { name, quantity, price, specs }.
- Put any ambiguous content in 'notes'.
- If uncertain about quantity, set it to null rather than guessing wild numbers.

OUTPUT SCHEMA:
{
  "vendorName": null,
  "vendorEmail": null,
  "totalPrice": null,
  "currency": null,
  "lineItems": [],
  "terms": null,
  "notes": null
}
`;

function buildUserPrompt({ emailText, html, attachmentsText = [], vendorEmail }) {
  const MAX_CHUNK = 14000; // characters cap for each block
  const parts = [];

  if (vendorEmail) parts.push(`VENDOR_EMAIL: ${vendorEmail}`);

  if (emailText) {
    const t = emailText.length > MAX_CHUNK ? emailText.slice(0, MAX_CHUNK) + '\n...[truncated]' : emailText;
    parts.push(`EMAIL_TEXT:\n${t}`);
  }
  if (html) {
    const h = html.length > MAX_CHUNK ? html.slice(0, MAX_CHUNK) + '\n...[truncated]' : html;
    parts.push(`EMAIL_HTML:\n${h}`);
  }

  attachmentsText.forEach((att, i) => {
    const content = att.content.length > MAX_CHUNK ? att.content.slice(0, MAX_CHUNK) + '\n...[truncated]' : att.content;
    parts.push(`ATTACHMENT_${i}_FILENAME: ${att.filename}\nATTACHMENT_${i}_TEXT:\n${content}`);
  });

  return parts.join('\n\n');
}

export async function parseProposalFromText({ emailText, html, attachmentsText = [], vendorEmail = null }) {
  const userPrompt = buildUserPrompt({ emailText, html, attachmentsText, vendorEmail });

  const resp = await client.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000
  });

  let jsonText = resp?.choices?.[0]?.message?.content || '';
  jsonText = jsonText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (err) {
    // throw so caller can fallback
    throw new Error('AI returned invalid JSON for proposal parsing');
  }
}
