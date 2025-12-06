import Rfp from '../model/rfp.model.js';
import Proposal from '../model/proposal.model.js';
import Vendor from '../model/vendor.model.js';
import mongoose from 'mongoose';

import {
  normalizeMoney,
  computeProposalScore
} from '../services/proposalProcessor.js';

/**
 * Helper: compute coverage (how many requested items are present in proposal)
 * returns { matchedCount, requestedCount, coverage } where coverage is 0..1
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
 * Helper: compare terms similarity / presence (simple heuristic)
 * returns score 0..1 and textual summary
 */
function computeTermsScore(rfpTerms = '', proposalTerms = '') {
  if (!rfpTerms && !proposalTerms) return { termsScore: 0.5, summary: 'No terms provided in both' };
  if (!proposalTerms) return { termsScore: 0.2, summary: 'Proposal missing terms' };

  // naive similarity: shared keywords
  const clean = text => (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const rtf = clean(rfpTerms);
  const pt = clean(proposalTerms);
  const rkw = Array.from(new Set(rtf.split(/\s+/).filter(Boolean)));
  const pkw = Array.from(new Set(pt.split(/\s+/).filter(Boolean)));
  const intersection = rkw.filter(x => pkw.includes(x));
  const union = Array.from(new Set([...rkw, ...pkw]));
  const jaccard = union.length ? (intersection.length / union.length) : 0;
  const termsScore = Math.round((0.3 + (jaccard * 0.7)) * 100) / 100; // bias small toward 0.3 baseline
  const summary = `Shared terms keywords: ${intersection.slice(0,10).join(', ') || 'none'}`;
  return { termsScore, summary };
}

/**
 * GET /rfps/:id/compare
 * Returns a list of proposals for the RFP with computed metrics and a recommended vendor.
 * Query params:
 *  - includeRaw=true to include rawText in response (careful: verbose)
 */
export const compareProposalsForRfp = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeRaw } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid RFP id' });
    }

    const rfp = await Rfp.findById(id).lean();
    if (!rfp) return res.status(404).json({ success: false, message: 'RFP not found' });

    // load proposals for this RFP
    const proposals = await Proposal.find({ rfp: id }).populate('vendor').lean();
    if (!proposals || !proposals.length) {
      return res.status(404).json({ success: false, message: 'No proposals found for this RFP' });
    }

    // compute price range for normalization
    const prices = proposals.map(p => (p.totalPrice != null ? Number(p.totalPrice) : null)).filter(v => v != null);
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    // prepare evaluated proposals
    const evaluated = proposals.map(p => {
      // normalized price info
      const priceNorm = normalizeMoney(p.totalPrice ?? null);
      const price = priceNorm.amount;
      const currency = priceNorm.currency || p.currency || null;

      // priceScore: relative (1 = cheapest, 0 = most expensive). If single price, set 1.
      let priceScore = 0.5;
      if (price != null && minPrice != null && maxPrice != null && maxPrice !== minPrice) {
        priceScore = 1 - ((price - minPrice) / (maxPrice - minPrice));
        priceScore = Math.round(Math.max(0, Math.min(1, priceScore)) * 100) / 100;
      } else if (price != null && minPrice != null && maxPrice === minPrice) {
        priceScore = 1;
      } else if (price != null) {
        priceScore = 0.6;
      }

      // coverage
      const cov = computeCoverage(rfp.items || [], p.lineItems || []);

      // terms score
      const termsInfo = computeTermsScore(rfp.paymentTerms || '', p.terms || '');

      // completeness score: combine coverage + presence of price + presence of terms
      const completeness = Math.round(((cov.coverage * 0.6) + (p.totalPrice ? 0.25 : 0) + (p.terms ? 0.15 : 0)) * 100) / 100;

      // final score: combine computeProposalScore (if present) but recalc fallback
      const builtinScore = (p.score != null) ? p.score : computeProposalScore({
        totalPrice: price,
        lineItems: p.lineItems || [],
        vendor: p.vendor || null
      }, rfp);

      // aggregated score: weighted blend of priceScore, completeness and builtinScore
      const aggregated = Math.round(((priceScore * 0.45) + (completeness * 0.35) + (builtinScore * 0.2)) * 100) / 100;

      return {
        proposalId: p._id,
        vendor: p.vendor ? { _id: p.vendor._id, name: p.vendor.name, email: p.vendor.email, rating: p.vendor.rating ?? null } : null,
        price,
        currency,
        priceScore,
        coverage: cov.coverage,
        matchedCount: cov.matchedCount,
        requestedCount: cov.requestedCount,
        termsScore: termsInfo.termsScore,
        termsSummary: termsInfo.summary,
        completeness,
        builtinScore,
        aggregatedScore: aggregated,
        receivedAt: p.receivedAt || p.createdAt || p._id.getTimestamp(),
        // include rawText only upon request
        rawText: includeRaw === 'true' ? p.rawText : undefined
      };
    });

    // sort by aggregatedScore desc, then price asc
    evaluated.sort((a, b) => {
      if (b.aggregatedScore !== a.aggregatedScore) return b.aggregatedScore - a.aggregatedScore;
      if ((a.price || Infinity) !== (b.price || Infinity)) return (a.price || Infinity) - (b.price || Infinity);
      return 0;
    });

    const recommended = evaluated[0];
    const recommendation = recommended ? {
      vendor: recommended.vendor,
      proposalId: recommended.proposalId,
      reason: [
        `Highest aggregated score (${recommended.aggregatedScore})`,
        recommended.price != null ? `Competitive price: ${recommended.price} ${recommended.currency || ''}` : null,
        `Coverage: ${Math.round(recommended.coverage * 100)}% (${recommended.matchedCount}/${recommended.requestedCount})`,
        `Terms match: ${Math.round(recommended.termsScore * 100)}%`
      ].filter(Boolean).join('; ')
    } : null;

    return res.json({
      success: true,
      rfp: { _id: rfp._id, title: rfp.title },
      recommended,
      recommendation,
      proposals: evaluated
    });
  } catch (err) {
    console.error('compareProposalsForRfp error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
