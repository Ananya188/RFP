import mongoose from 'mongoose';
import Proposal from '../model/proposal.model.js';
import Rfp from '../model/rfp.model.js';

export function normalizeMoney(raw) {
  if (!raw && raw !== 0) return { amount: null, currency: null };

  // If already number
  if (typeof raw === 'number') return { amount: raw, currency: null };

  let s = String(raw).trim();
  // find currency symbol if present
  const currencyMatch = s.match(/(₹|Rs\.?|INR|USD|\$|EUR|€|£|GBP)/i);
  let currency = currencyMatch ? currencyMatch[0].replace('.', '').toUpperCase() : null;
  // remove non-numeric except . and -
  const numStr = s.replace(/[^0-9.\-]/g, '');
  const amount = numStr ? Number(numStr) : null;
  // normalize some currency tokens
  if (currency) {
    if (/₹|RS/i.test(currency)) currency = 'INR';
    if (/\$|USD/.test(currency)) currency = 'USD';
    if (/EUR|€/.test(currency)) currency = 'EUR';
    if (/£|GBP/.test(currency)) currency = 'GBP';
  }
  return { amount: Number.isFinite(amount) ? amount : null, currency };
}

/**
 * computeConfidence(parsed, rawText)
 * Very simple heuristic: presence of totalPrice + some line items increases confidence.
 * Returns 0.0 .. 1.0
 */
export function computeConfidence(parsed = {}, rawText = '') {
  let score = 0;

  if (parsed.totalPrice || parsed.totalPrice === 0) score += 0.5;
  if (parsed.lineItems && parsed.lineItems.length >= 1) {
    score += 0.3;
    if (parsed.lineItems.length >= 2) score += 0.1;
  }
  if (parsed.terms) score += 0.05;
  // presence of numeric tokens in raw text increases confidence slightly
  const hasNumbers = /\d/.test(rawText) ? 0.05 : 0;
  score += hasNumbers;

  if (score > 1) score = 1;
  return Math.round(score * 100) / 100;
}

/**
 * computeProposalScore(proposal, rfp)
 * Weighted score combining price (lower better), coverage (line items match), and vendor rating.
 * Returns 0..1
 */
export function computeProposalScore(proposal, rfp) {
  // price score: if rfp.totalBudget known then price vs budget, else relative to other proposals handled elsewhere
  let priceScore = 0.5;
  if (proposal.totalPrice && rfp.totalBudget) {
    const ratio = proposal.totalPrice / Math.max(1, rfp.totalBudget);
    // cheaper than budget -> higher; if price > budget then lower
    priceScore =
      ratio <= 1
        ? 1 - ratio * 0.3
        : Math.max(0, 1 - Math.min(ratio - 1, 1)); // gentle scaling
  } else if (proposal.totalPrice) {
    priceScore = 0.6;
  } else {
    priceScore = 0.3;
  }

  // coverage: match number of RFP items present in proposal lineItems
  const requested = (rfp.items || []).map((i) => (i.name || '').toLowerCase());
  const proposedNames = (proposal.lineItems || []).map((li) =>
    (li.name || '').toLowerCase()
  );
  let matches = 0;
  requested.forEach((rn) => {
    if (proposedNames.some((pn) => pn.includes(rn) || rn.includes(pn))) matches++;
  });
  const coverage = requested.length ? matches / requested.length : 0.5;

  // vendorRating from proposal.vendor (optional)
  let ratingScore = 0.5;
  if (proposal.vendor && proposal.vendor.rating) {
    const r = Math.max(1, Math.min(5, proposal.vendor.rating));
    ratingScore = (r - 1) / 4; // map 1..5 -> 0..1
  }

  const final = Math.min(
    1,
    priceScore * 0.5 + coverage * 0.35 + ratingScore * 0.15
  );
  return Math.round(final * 100) / 100;
}

/**
 * Optional helper: processAndPersistProposal
 * (not used by emailController, but available for other flows)
 */
export async function processAndPersistProposal(parsedProposal, propDoc, rfp, options = {}) {
  const CONFIDENCE_THRESHOLD = options.confidenceThreshold ?? 0.6;

  // normalize total price
  const norm = normalizeMoney(parsedProposal.totalPrice ?? propDoc.totalPrice);
  const totalPrice = norm.amount;
  const currency = norm.currency || parsedProposal.currency || null;

  const normalizedItems = (parsedProposal.lineItems || []).map((li) => {
    const name = li.name || li.description || null;
    let qty = null;
    if (li.quantity !== undefined && li.quantity !== null) {
      qty = Number(li.quantity) || null;
    } else {
      const m = (name || '').match(/(\d+)\s*$/);
      if (m) qty = Number(m[1]);
    }
    const priceNorm = normalizeMoney(li.price ?? li.unitPrice ?? li.totalPrice);
    const price = priceNorm.amount;
    const specs = li.specs || {};
    return { name, quantity: qty, price, specs };
  });

  const confidence = computeConfidence(parsedProposal, propDoc.rawText || '');
  const vendor =
    propDoc.vendor && typeof propDoc.vendor === 'object' ? propDoc.vendor : null;

  const tempProposal = {
    totalPrice,
    lineItems: normalizedItems,
    vendor: vendor || null
  };
  const score = computeProposalScore(tempProposal, rfp);

  propDoc.totalPrice = totalPrice ?? propDoc.totalPrice ?? null;
  propDoc.currency = currency ?? propDoc.currency ?? null;
  propDoc.lineItems = normalizedItems.length
    ? normalizedItems
    : propDoc.lineItems || [];
  propDoc.terms = parsedProposal.terms || propDoc.terms || null;
  propDoc.metadata = {
    ...propDoc.metadata,
    autoParsed: true,
    confidence,
    parsedAt: new Date(),
    parsedRaw: parsedProposal
  };
  propDoc.score = score;
  await propDoc.save();

  if (confidence >= CONFIDENCE_THRESHOLD) {
    const proposals = await Proposal.find({ rfp: rfp._id }).lean();
    let best = null;
    for (const p of proposals) {
      if (!best || (p.score ?? 0) > (best.score ?? 0)) best = p;
    }
    const bestId = best?._id ? String(best._id) : null;
    if (bestId && (!rfp.bestProposal || String(rfp.bestProposal) !== bestId)) {
      rfp.bestProposal = bestId;
      rfp.bestPrice = best.totalPrice ?? null;
      rfp.bestProposalUpdatedAt = new Date();
      rfp.lastUpdatedByAI = true;
      rfp.lastAIUpdateReason = 'new_proposal_parsed';
      await rfp.save();
    }
  } else {
    propDoc.metadata = { ...propDoc.metadata, needsReview: true };
    await propDoc.save();
  }

  return propDoc;
}
