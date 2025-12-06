// controllers/emailController.js
import mongoose from 'mongoose';
import {
  extractRfpIdFromSubject,
  fetchAndParseUnseenEmails
} from '../services/emailIndoxServies.js';
import Rfp from '../model/rfp.model.js';
import Vendor from '../model/vendor.model.js';
import { parseProposalFromText } from '../services/proposalParserAI.js';
import Proposal from '../model/proposal.model.js';
import {
  normalizeMoney,
  computeConfidence,
  computeProposalScore
} from '../services/proposalProcessor.js';

const OP_TIMEOUT_MS = 30_000;        // overall request timeout (ms)
const FETCH_TIMEOUT_MS = 20_000;     // timeout for fetchAndParseUnseenEmails
const PER_EMAIL_TIMEOUT_MS = 12_000; // per-email processing timeout
const PARSE_TIMEOUT_MS = 8_000;      // parseProposalFromText timeout
const SAVE_TIMEOUT_MS = 8_000;       // mongoose save timeout

async function runWithTimeout(promiseOrFn, timeoutMs = OP_TIMEOUT_MS, label = 'operation') {
  const p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  return Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function saveWithTimeout(doc, timeoutMs = SAVE_TIMEOUT_MS) {
  return runWithTimeout(() => doc.save(), timeoutMs, 'mongoose-save');
}

/**
 * POST /emails/fetch
 * Fetch unseen emails, parse proposals, save Proposal docs, auto-normalize & score.
 * IMPORTANT: This controller DOES NOT modify RFP documents or update RFP lifecycle fields.
 */
export const fetchAndProcessEmails = async (req, res) => {
  const startTs = Date.now();
  console.info('[email] fetchAndProcessEmails start', new Date().toISOString());

  try {
    // 1) fetch emails (with timeout)
    const emails = await fetchAndParseUnseenEmails({ maxMessages: 5 });
    console.info('[email] raw emails fetched:', emails?.length);
    
    if (!Array.isArray(emails)) {
      console.warn('[email] fetchAndParseUnseenEmails returned non-array, treating as empty');
    }
    const items = Array.isArray(emails) ? emails : [];
    console.info(`[email] fetched ${items.length} emails`);

    const results = [];

    // 2) process each email with per-email timeout guard
    for (const em of items) {
      try {
        const singleResult = await runWithTimeout(
          async () => {
            console.info(
              `[email] processing uid=${em.uid} subject="${(em.subject || '').slice(0, 80)}"`
            );

            // Try to extract RFP id from subject (read-only)
            const rfpId = extractRfpIdFromSubject(em.subject || '');
            let rfp = null;
            if (rfpId && mongoose.Types.ObjectId.isValid(rfpId)) {
              try {
                rfp = await Rfp.findById(rfpId).lean();
                if (!rfp) console.info(`[email] rfp ${rfpId} not found`);
              } catch (e) {
                console.warn(`[email] error fetching rfp ${rfpId}:`, e.message);
              }
            }

            // Determine sender email and vendor (read-only)
            const fromAddr =
              (em.fromValue && em.fromValue[0] && em.fromValue[0].address) || null;
            let vendor = null;
            if (fromAddr) {
              try {
                vendor = await Vendor.findOne({ email: fromAddr.toLowerCase() });
              } catch (e) {
                console.warn(`[email] vendor lookup failed for ${fromAddr}:`, e.message);
              }
            }

            // Build parser input
            const parserInput = {
              emailText: em.text || '',
              html: em.html || '',
              attachmentsText: em.attachmentsText || [], // [{ filename, content }]
              vendorEmail: fromAddr || null
            };

            // Attempt to parse with AI; fallback to heuristics
            let parsed = null;
            let parsedByAI = false;
            try {
              parsed = await runWithTimeout(
                () => parseProposalFromText(parserInput),
                PARSE_TIMEOUT_MS,
                'parseProposalFromText'
              );
              parsedByAI = true;
            } catch (err) {
              console.warn(`[email] AI parse failed uid=${em.uid}:`, err.message);
              // Fallback heuristics: try extract price
              const priceMatch = (em.text || '').match(
                /([₹$€£]\s?[\d,]+(?:\.\d+)?)/
              );
              const totalPrice = priceMatch
                ? Number(priceMatch[1].replace(/[^0-9.]/g, ''))
                : null;
              parsed = {
                vendorName: vendor?.name || null,
                vendorEmail: fromAddr || null,
                totalPrice,
                currency: null,
                lineItems: [],
                terms: null,
                notes: em.text ? em.text.slice(0, 2000) : ''
              };
            }

            // Compose initial Proposal payload (linked to RFP if found)
            let proposalVendorEmail =
              (parsed.vendorEmail || fromAddr || '').toLowerCase();
            if (!proposalVendorEmail) {
              // keep schema happy even if email missing
              proposalVendorEmail = 'unknown@vendor.local';
            }

            const proposalPayload = {
              rfp:
                rfp && rfp._id
                  ? rfp._id
                  : rfpId && mongoose.Types.ObjectId.isValid(rfpId)
                  ? rfpId
                  : null,
              vendor: vendor ? vendor._id : null,
              vendorEmail: proposalVendorEmail,
              vendorName: parsed.vendorName || (vendor ? vendor.name : null),
              totalPrice: parsed.totalPrice ?? null,
              currency: parsed.currency ?? null,
              lineItems: parsed.lineItems || [],
              terms: parsed.terms || null,
              rawText: em.text || em.html || '',
              attachments: em.attachments || [], // metadata from inbox service
              metadata: {
                parsedByAI,
                parsedRaw: parsed,
                needsReview: false
              },
              receivedAt: em.date || new Date()
            };

            // Save initial Proposal (safe save)
            const propDoc = new Proposal(proposalPayload);
            try {
              await saveWithTimeout(propDoc);
            } catch (saveErr) {
              console.warn(
                `[email] initial proposal save failed uid=${em.uid}:`,
                saveErr.message
              );
              // continue - we still want normalization / scoring
            }

            // Normalization & scoring (guarded)
            try {
              const norm = normalizeMoney(
                parsed.totalPrice ?? proposalPayload.totalPrice
              );
              const normalizedTotal = norm.amount;
              const normalizedCurrency =
                norm.currency || parsed.currency || null;

              const normalizedItems = (parsed.lineItems || []).map((li) => {
                const name = li.name || li.description || null;
                let qty = null;
                if (li.quantity !== undefined && li.quantity !== null) {
                  qty = Number(li.quantity) || null;
                } else {
                  const m = (name || '').match(/(\d+)\s*$/);
                  if (m) qty = Number(m[1]);
                }
                const priceNorm = normalizeMoney(
                  li.price ?? li.unitPrice ?? li.totalPrice
                );
                const price = priceNorm.amount;
                const specs = li.specs || {};
                return { name, quantity: qty, price, specs };
              });

              const confidence = computeConfidence(
                parsed,
                proposalPayload.rawText || ''
              );

              const score = computeProposalScore(
                {
                  totalPrice: normalizedTotal,
                  lineItems: normalizedItems,
                  vendor: vendor || null
                },
                rfp || {
                  items: proposalPayload.lineItems || [],
                  totalBudget: null
                }
              );

              // Update and save (safe)
              propDoc.totalPrice =
                normalizedTotal ?? propDoc.totalPrice ?? null;
              propDoc.currency =
                normalizedCurrency ?? propDoc.currency ?? null;
              if (normalizedItems.length) propDoc.lineItems = normalizedItems;
              if (parsed.terms) propDoc.terms = parsed.terms;
              propDoc.score = score;
              propDoc.metadata = {
                ...propDoc.metadata,
                autoParsed: true,
                confidence,
                parsedAt: new Date(),
                parsedByAI
              };
              propDoc.metadata.needsReview = confidence < 0.6;

              try {
                await saveWithTimeout(propDoc);
              } catch (saveErr2) {
                console.warn(
                  `[email] save after normalization failed uid=${em.uid}:`,
                  saveErr2.message
                );
              }
            } catch (procErr) {
              console.warn(
                `[email] normalization/scoring failed uid=${em.uid}:`,
                procErr.message
              );
              propDoc.metadata = {
                ...propDoc.metadata,
                processingError: String(procErr)
              };
              try {
                await saveWithTimeout(propDoc);
              } catch (_) {
                /* ignore */
              }
            }

            // Build response entry
            return {
              uid: em.uid,
              ok: true,
              proposalId: propDoc._id,
              linkedRfp:
                rfp && rfp._id
                  ? rfp._id
                  : rfpId && mongoose.Types.ObjectId.isValid(rfpId)
                  ? rfpId
                  : null,
              vendorId: vendor ? vendor._id : null,
              needsReview: propDoc.metadata?.needsReview ?? false
            };
          },
          PER_EMAIL_TIMEOUT_MS,
          `process-email-uid-${em.uid}`
        );

        results.push(singleResult);
      } catch (singleErr) {
        // Per-email timeout or error
        console.warn(
          `[email] per-email timeout/error uid=${em?.uid}:`,
          singleErr.message
        );
        results.push({
          uid: em?.uid || null,
          ok: false,
          reason: singleErr.message
        });
      }
    }

    console.info('[email] fetchAndProcessEmails complete', {
      durationMs: Date.now() - startTs
    });
    return res.json({ success: true, results });
  } catch (err) {
    console.error('[email] fetchAndProcessEmails error', err);
    return res
      .status(500)
      .json({ success: false, message: err.message || 'Unknown error' });
  }
};

/**
 * POST /emails/preview
 * Body: { emailText, html, attachmentsText, vendorEmail }
 * Returns parsed JSON without saving to DB.
 */
export const previewParse = async (req, res) => {
  try {
    const { emailText, html, attachmentsText = [], vendorEmail = null } = req.body;
    if (!emailText && !html && (!attachmentsText || !attachmentsText.length)) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Provide emailText or html or attachmentsText'
        });
    }

    // delegate to the same AI parser used in fetch flow, but guarded by timeout
    const parsed = await runWithTimeout(
      () => parseProposalFromText({ emailText, html, attachmentsText, vendorEmail }),
      PARSE_TIMEOUT_MS,
      'preview-parseProposalFromText'
    );

    const norm = normalizeMoney(parsed.totalPrice ?? null);
    const normalizedTotal = norm.amount;
    const normalizedCurrency = norm.currency || parsed.currency || null;
    const confidence = computeConfidence(parsed, emailText || '');

    return res.json({
      success: true,
      parsed,
      normalized: {
        totalPrice: normalizedTotal,
        currency: normalizedCurrency,
        confidence
      }
    });
  } catch (err) {
    console.error('previewParse error', err);
    return res
      .status(500)
      .json({ success: false, message: err.message || 'Preview parse failed' });
  }
};

/**
 * POST /proposals/:id/reprocess
 * Re-run normalization/scoring/metadata update for an existing Proposal.
 * Does NOT modify any RFP documents or lifecycle fields.
 */
export const reprocessProposal = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid proposal id' });
    }

    const prop = await Proposal.findById(id);
    if (!prop)
      return res
        .status(404)
        .json({ success: false, message: 'Proposal not found' });

    const overrideParsed = req.body?.parsed || null;

    let parsed = null;
    if (overrideParsed) {
      parsed = overrideParsed;
    } else if (prop.metadata && prop.metadata.parsedRaw) {
      parsed = prop.metadata.parsedRaw;
    } else {
      // attempt to re-parse rawText via AI (guarded)
      try {
        parsed = await runWithTimeout(
          () =>
            parseProposalFromText({
              emailText: prop.rawText || '',
              html: null,
              attachmentsText: prop.attachments || [],
              vendorEmail: prop.vendorEmail || null
            }),
          PARSE_TIMEOUT_MS,
          'reprocess-parseProposalFromText'
        );
      } catch (err) {
        console.warn(
          '[email] reprocess AI parse failed, falling back to heuristics:',
          err.message
        );
        const priceMatch = (prop.rawText || '').match(
          /([₹$€£]\s?[\d,]+(?:\.\d+)?)/,
        );
        const totalPrice = priceMatch
          ? Number(priceMatch[1].replace(/[^0-9.]/g, ''))
          : null;
        parsed = {
          vendorName: prop.vendorName || null,
          vendorEmail: prop.vendorEmail || null,
          totalPrice,
          currency: null,
          lineItems: [],
          terms: null,
          notes: prop.rawText ? prop.rawText.slice(0, 2000) : ''
        };
      }
    }

    // normalize & compute
    const norm = normalizeMoney(parsed.totalPrice ?? prop.totalPrice);
    const normalizedTotal = norm.amount;
    const normalizedCurrency =
      norm.currency || parsed.currency || prop.currency || null;

    const normalizedItems = (parsed.lineItems || []).map((li) => {
      const name = li.name || li.description || null;
      let qty = null;
      if (li.quantity !== undefined && li.quantity !== null) {
        qty = Number(li.quantity) || null;
      }
      const priceNorm = normalizeMoney(
        li.price ?? li.unitPrice ?? li.totalPrice
      );
      const price = priceNorm.amount;
      const specs = li.specs || {};
      return { name, quantity: qty, price, specs };
    });

    const confidence = computeConfidence(parsed, prop.rawText || '');
    const linkedRfp = prop.rfp ? await Rfp.findById(prop.rfp).lean() : null;
    const score = computeProposalScore(
      {
        totalPrice: normalizedTotal,
        lineItems: normalizedItems,
        vendor: prop.vendor || null
      },
      linkedRfp || { items: prop.lineItems || [], totalBudget: null }
    );

    prop.totalPrice = normalizedTotal ?? prop.totalPrice ?? null;
    prop.currency = normalizedCurrency ?? prop.currency ?? null;
    if (normalizedItems.length) prop.lineItems = normalizedItems;
    if (parsed.terms) prop.terms = parsed.terms;
    prop.score = score;
    prop.metadata = {
      ...prop.metadata,
      autoParsed: true,
      confidence,
      parsedAt: new Date(),
      parsedByAI: !!parsed && !!parsed.vendorEmail
    };
    prop.metadata.needsReview = confidence < 0.6;

    try {
      await saveWithTimeout(prop);
    } catch (saveErr) {
      console.warn('[email] reprocess save failed:', saveErr.message);
      // still return success but inform caller
      return res.json({
        success: true,
        proposalId: prop._id,
        needsReview: prop.metadata.needsReview,
        score: prop.score,
        warning:
          'save timeout or error (proposal updated in-memory but may not have persisted).'
      });
    }

    return res.json({
      success: true,
      proposalId: prop._id,
      needsReview: prop.metadata.needsReview,
      score: prop.score
    });
  } catch (err) {
    console.error('reprocessProposal error', err);
    return res
      .status(500)
      .json({ success: false, message: err.message || 'Reprocess failed' });
  }
};
