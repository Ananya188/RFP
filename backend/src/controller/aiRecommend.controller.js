import mongoose from 'mongoose';
import OpenAI from 'openai';
import Rfp from '../model/rfp.model.js';
import Proposal from '../model/proposal.model.js';
import { normalizeMoney, computeProposalScore } from '../services/proposalProcessor.js';

/**
 * computeCoverage simple helper (same as compare controller)
 * returns { matchedCount, requestedCount, coverage }
 */
function computeCoverage(rfpItems = [], proposalLineItems = []) {
  const requested = (rfpItems || []).map(i => (i.name || '').toLowerCase());
  const proposed = (proposalLineItems || []).map(li => (li.name || '').toLowerCase());
  let matches = 0;
  requested.forEach(req => {
    if (proposed.some(p => p.includes(req) || req.includes(p))) matches++;
  });
  const requestedCount = requested.length || 0;
  const coverage = requestedCount ? (matches / requestedCount) : (proposalLineItems && proposalLineItems.length ? 0.5 : 0);
  return { matchedCount: matches, requestedCount, coverage: Math.round(coverage * 100) / 100 };
}

/**
 * Build compact table of proposals to send to LLM
 */
async function buildProposalSummaries(rfpId, rfp) {
  const proposals = await Proposal.find({ rfp: rfpId }).populate('vendor').lean();
  const summaries = proposals.map(p => {
    const priceNorm = normalizeMoney(p.totalPrice ?? null);
    const price = priceNorm.amount;
    const currency = priceNorm.currency || p.currency || null;
    const cov = computeCoverage(rfp.items || [], p.lineItems || []);
    const builtinScore = p.score ?? computeProposalScore({ totalPrice: price, lineItems: p.lineItems || [], vendor: p.vendor || null }, rfp);
    const completeness = Math.round(((cov.coverage * 0.6) + (p.totalPrice ? 0.25 : 0) + (p.terms ? 0.15 : 0)) * 100) / 100;
    return {
      proposalId: String(p._id),
      vendorName: p.vendor ? p.vendor.name : p.vendorName || null,
      vendorEmail: p.vendor ? p.vendor.email : p.vendorEmail || null,
      price,
      currency,
      priceScore: price != null ? null : null, // LLM may compute, we provide numbers for it
      coverage: cov.coverage,
      matchedCount: cov.matchedCount,
      requestedCount: cov.requestedCount,
      terms: p.terms || null,
      completeness,
      builtinScore,
      rawNotes: (p.metadata && p.metadata.needsReview) ? 'needsReview' : null
    };
  });

  // sort by builtinScore desc then price asc and return
  summaries.sort((a, b) => {
    if ((b.builtinScore ?? 0) !== (a.builtinScore ?? 0)) return (b.builtinScore ?? 0) - (a.builtinScore ?? 0);
    if ((a.price ?? Infinity) !== (b.price ?? Infinity)) return (a.price ?? Infinity) - (b.price ?? Infinity);
    return 0;
  });

  return summaries;
}

/**
 * GET /rfps/:id/ai-recommendation
 * Returns an AI-generated recommendation JSON + local numeric table.
 */
export const aiRecommendForRfp = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid RFP id' });
    }

    const rfp = await Rfp.findById(id).lean();
    if (!rfp) return res.status(404).json({ success: false, message: 'RFP not found' });

    const summaries = await buildProposalSummaries(id, rfp);
    if (!summaries.length) {
      return res.status(404).json({ success: false, message: 'No proposals found for this RFP' });
    }

    // Prepare a compact JSON context for the LLM (limit to top N proposals to keep prompt small)
    const TOP_N = 6;
    const contextProposals = summaries.slice(0, TOP_N).map(p => ({
      proposalId: p.proposalId,
      vendorName: p.vendorName,
      price: p.price,
      currency: p.currency,
      coverage: p.coverage,
      completeness: p.completeness,
      builtinScore: p.builtinScore,
      terms: p.terms || ''
    }));

    // Build system + user prompts. We instruct strict JSON output.
    const systemPrompt = `
You are a procurement advisor. Given structured proposal summaries for an RFP, produce a concise recommendation answering: "Which vendor should I go with, and why?"
STRICT OUTPUT:
Return ONLY valid JSON that exactly matches this schema:

{
  "recommendedProposalId": "<proposalId string>",
  "vendor": { "name": "<vendor name>", "email": "<vendor email or null>" },
  "decision": "recommend | consider | no_clear_winner",
  "confidence": 0.0,
  "summary": "short human-readable recommendation (1-3 sentences)",
  "detailedReasoning": "bullet points or short paragraphs explaining tradeoffs (max 6 bullets)",
  "scores": [
    {
      "proposalId": "<id>",
      "price": 12345,
      "currency": "USD",
      "coverage": 0.75,
      "completeness": 0.8,
      "builtinScore": 0.85,
      "finalScore": 0.82
    }
  ]
}

Rules:
- Pick the best candidate by balancing price, coverage (how many requested items are covered), proposal completeness/terms, and any builtinScore.
- If proposals are too close or important data missing (price or coverage), set decision to 'consider' or 'no_clear_winner' and mention missing data in detailedReasoning.
- confidence should be a float 0.0-1.0 expressing how confident the LLM is in its recommendation.
- Keep 'summary' short (<= 3 sentences) and ensure 'detailedReasoning' lists clear, actionable bullets.
- Do NOT modify the RFP or any database; only return JSON.
`;

    // user prompt contains the RFP brief + proposals JSON
    const userPrompt = `RFP Title: ${rfp.title || ''}\nRFP Description: ${rfp.description || ''}\n\nProposals:\n${JSON.stringify(contextProposals, null, 2)}\n\nProvide the recommendation JSON as specified.`;

    // call OpenAI
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: 'gpt-4.1',
      temperature: 0.0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800
    });

    let aiText = resp?.choices?.[0]?.message?.content || '';
    aiText = aiText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

    // Parse JSON from AI (safe)
    let aiJson = null;
    try {
      aiJson = JSON.parse(aiText);
    } catch (err) {
      // fallback: produce a simple local recommendation using builtinScore & price
      console.warn('AI returned invalid JSON, falling back to local heuristic', err);
      const fallback = localFallbackRecommendation(summaries);
      return res.json({ success: true, ai: null, fallback, note: 'LLM response invalid — returned local fallback' });
    }

    // Return LLM result plus the local numeric table for transparency
    return res.json({ success: true, rfp: { _id: rfp._id, title: rfp.title }, aiRecommendation: aiJson, localTable: summaries });
  } catch (err) {
    console.error('aiRecommendForRfp error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * localFallbackRecommendation: simple deterministic fallback (no LLM)
 * chooses highest builtinScore; ties favor lower price.
 */
function localFallbackRecommendation(summaries) {
  if (!summaries || !summaries.length) return null;
  // choose highest builtinScore, then lowest price
  let best = summaries[0];
  for (const s of summaries) {
    if ((s.builtinScore ?? 0) > (best.builtinScore ?? 0)) best = s;
    else if ((s.builtinScore ?? 0) === (best.builtinScore ?? 0)) {
      const sp = s.price ?? Infinity;
      const bp = best.price ?? Infinity;
      if (sp < bp) best = s;
    }
  }
  return {
    recommendedProposalId: best.proposalId,
    vendor: { name: best.vendorName, email: best.vendorEmail },
    reason: `Fallback: highest builtinScore (${best.builtinScore}) and competitive price (${best.price} ${best.currency || ''}).`,
    localTableTop: summaries.slice(0, 5)
  };
}
