import mongoose from 'mongoose';
import _ from 'lodash';
import { extractRfpAI } from '../services/aiRfpExtractor.js';
import { parseWithRules } from '../services/ruleParse.js';
import Rfp from '../model/rfp.model.js';
import Vendor from '../model/vendor.model.js';
import Proposal from '../model/proposal.model.js';
import formatMongooseError from "../services/errorHandles.js";
import { sendEmail, sendRfpEmail } from '../services/emailServices.js';


/* 1) Create RFP (AI + fallback). Returns parsed RFP. */
export const createRFP = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'text required' });

    let parsed;
    try {
      parsed = await extractRfpAI(text);
    } catch (err) {
      console.warn('AI parse failed, falling back to rule parser:', err?.message || err);
      parsed = parseWithRules(text);
    }

    const title = parsed?.title && String(parsed.title).trim() ? String(parsed.title).trim() : 'Untitled RFP';

    const rfpPayload = {
      title,
      description: text,
      items: parsed?.items || [],
      totalBudget: parsed?.totalBudget ?? null,
      deliveryDays: parsed?.deliveryDays ?? null,
      paymentTerms: parsed?.paymentTerms ?? null,
      warrantyMonths: parsed?.warrantyMonths ?? null,
      // no status or sent fields (minimal single-user model)
      createdBy: req.user?.email || process.env.ADMIN_EMAIL || 'admin@local'
    };

    const rfp = new Rfp(rfpPayload);
    const saved = await rfp.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('createRFP error:', err);
    const formatted = formatMongooseError(err);
    if (formatted.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: formatted });
    }
    if (formatted.name === 'DuplicateKey') {
      return res.status(409).json({ success: false, error: formatted });
    }
    return res.status(500).json({ success: false, message: formatted.message || 'Internal server error' });
  }
};

/* 2) Confirm RFP — simple update; prevent changing createdBy */
export const confirmRFP = async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'invalid id' });

    if (updates && typeof updates === 'object') {
      delete updates.createdBy; // prevent tampering with createdBy
      // no sentBy / sentAt fields in minimal model — nothing else to delete
    }

    const rfp = await Rfp.findByIdAndUpdate(id, updates || {}, { new: true, runValidators: true });
    if (!rfp) return res.status(404).json({ message: 'RFP not found' });
    return res.json({ success: true, data: rfp });
  } catch (err) {
    console.error('confirmRFP error:', err);
    const formatted = formatMongooseError(err);
    if (formatted.name === 'ValidationError') return res.status(400).json({ success: false, error: formatted });
    if (formatted.name === 'CastError') return res.status(400).json({ success: false, error: formatted });
    return res.status(500).json({ success: false, message: formatted.message || 'Internal server error' });
  }
}
/* --- Updated sendRFPToVendors — stronger validation for vendorIds --- */
export const sendRFPToVendors = async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorIds, subject, message, attachJson = false } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid RFP ID' });

    const rfp = await Rfp.findById(id);
    if (!rfp)
      return res.status(404).json({ success: false, message: 'RFP not found' });

    // If user doesn't provide vendor IDs → return candidates for selection
    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "vendorIds is required. Fetch candidates first via GET /rfps/:id/candidates"
      });
    }

    // Validate vendor IDs
    const validVendorIds = vendorIds.filter(v => mongoose.Types.ObjectId.isValid(v));
    const vendors = await Vendor.find({ _id: { $in: validVendorIds } });

    if (!vendors.length)
      return res.status(404).json({ success: false, message: 'No valid vendors found' });

    const finalSubject = subject || `RFP Invitation: ${rfp.title}`;
    const finalMessage = message || `You are invited to submit a proposal for: ${rfp.title}`;

    const sendResults = [];

    for (const vendor of vendors) {
      try {
        if (!vendor.email) {
          sendResults.push({ vendor: vendor._id, ok: false, reason: "No vendor email" });
          continue;
        }

        // 🔥 NEW: Use the AI-powered, formatted email sender
        const info = await sendRfpEmail(rfp, vendor, {
          subject: finalSubject,
          message: finalMessage,
          attachJson
        });

        sendResults.push({ vendor: vendor._id, ok: true, messageId: info.messageId });

      } catch (err) {
        sendResults.push({ vendor: vendor._id, ok: false, reason: err.message });
      }
    }

    // Update RFP audit fields
    const successfulVendors = sendResults.filter(r => r.ok).map(r => r.vendor);

    rfp.sentTo = [...new Set([...(rfp.sentTo || []), ...successfulVendors])];
    if (successfulVendors.length) {
      rfp.status = "sent";
      rfp.sentBy = process.env.ADMIN_EMAIL || 'admin@local';
      rfp.sentAt = new Date();
    }
    await rfp.save();

    return res.json({
      success: true,
      message: "Emails processed",
      sent: successfulVendors.length,
      results: sendResults,
      rfp
    });

  } catch (err) {
    console.error("sendRFPToVendors error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export const getVendorCandidates = async (req, res) => {
  try {
    const { id } = req.params;
    const mode = (req.query.mode || 'any').toLowerCase(); // 'any' or 'all'
    const checkStock = String(req.query.checkStock || 'false').toLowerCase() === 'true';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'invalid rfp id' });
    }

    // load rfp
    const rfp = await Rfp.findById(id).lean();
    if (!rfp) return res.status(404).json({ success: false, message: 'RFP not found' });

    const rawItems = Array.isArray(rfp.items) ? rfp.items : [];

    // detect whether items include usable itemId/_id fields
    const hasItemIds = rawItems.some(i => !!(i.itemId || i._id || i.id));

    // prepare common name patterns (from item names) for use in category matching
    const itemNames = rawItems.map(i => (i.name || '').trim()).filter(Boolean);
    const namePatterns = itemNames.map(n => escapeRegex(n)); // pattern strings

    if (hasItemIds) {
      // itemId-based aggregation (fast + precise)
      const items = rawItems
        .map(i => ({
          id: String(i.itemId ?? i._id ?? i.id).trim(),
          qty: typeof i.qty === 'number' ? i.qty : (i.quantity || 1),
          name: i.name || null
        }))
        .filter(it => it.id);

      if (!items.length) return res.json({ success: true, count: 0, data: [], meta: { totalRequested: 0 } });

      const itemIdsStr = Array.from(new Set(items.map(f => String(f.id))));
      const requestedQtys = itemIdsStr.map(idStr => items.find(f => f.id === idStr).qty || 1);
      const totalRequested = itemIdsStr.length;

      const pipeline = [];

      // require vendors with catalog array
      pipeline.push({ $match: { catalog: { $exists: true, $ne: [] } } });

      // matched catalog entries whose itemId (stringified) is in itemIdsStr
      pipeline.push({
        $addFields: {
          matched: {
            $filter: {
              input: '$catalog',
              as: 'c',
              cond: { $in: [{ $toString: '$$c.itemId' }, itemIdsStr] }
            }
          }
        }
      });

      if (checkStock) {
        pipeline.push({
          $addFields: {
            matchedWithStock: {
              $filter: {
                input: '$matched',
                as: 'm',
                cond: {
                  $let: {
                    vars: { idx: { $indexOfArray: [itemIdsStr, { $toString: '$$m.itemId' }] } },
                    in: {
                      $gte: [
                        { $ifNull: ['$$m.stock', 0] },
                        { $arrayElemAt: [requestedQtys, '$$idx'] }
                      ]
                    }
                  }
                }
              }
            }
          }
        });

        pipeline.push({
          $addFields: {
            matchedCount: { $size: '$matchedWithStock' },
            avgPrice: { $cond: [{ $gt: [{ $size: '$matchedWithStock' }, 0] }, { $avg: '$matchedWithStock.price' }, null] },
            hasAllStock: { $eq: [{ $size: '$matchedWithStock' }, totalRequested] }
          }
        });
      } else {
        pipeline.push({
          $addFields: {
            matchedCount: { $size: '$matched' },
            avgPrice: { $cond: [{ $gt: [{ $size: '$matched' }, 0] }, { $avg: '$matched.price' }, null] },
            hasAllStock: { $eq: [{ $size: '$matched' }, totalRequested] }
          }
        });
      }

      // compute which categories matched the item names (topMatchedCategories)
      if (namePatterns.length > 0) {
        pipeline.push({
          $addFields: {
            topMatchedCategories: {
              $filter: {
                input: { $ifNull: ['$categories', []] },
                as: 'cat',
                cond: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: namePatterns.map(p => ({ $regexMatch: { input: '$$cat', regex: p, options: 'i' } })),
                          as: 'm',
                          cond: { $eq: ['$$m', true] }
                        }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        });
      } else {
        pipeline.push({ $addFields: { topMatchedCategories: [] } });
      }

      // mode filtering
      if (mode === 'any') pipeline.push({ $match: { matchedCount: { $gt: 0 } } });
      else if (mode === 'all') pipeline.push({ $match: { matchedCount: totalRequested } });
      else pipeline.push({ $match: { matchedCount: { $gt: 0 } } });

      // scoring
      pipeline.push({
        $addFields: {
          coverage: { $cond: [{ $gt: [totalRequested, 0] }, { $divide: ['$matchedCount', totalRequested] }, 0] },
          ratingNorm: {
            $cond: [
              { $and: [{ $ne: ['$rating', null] }, { $gte: ['$rating', 0] }] },
              { $min: ['$rating', 5] },
              0
            ]
          }
        }
      });

      pipeline.push({
        $addFields: {
          _score: {
            $add: [
              { $multiply: ['$coverage', 0.7] },
              { $multiply: [{ $divide: ['$ratingNorm', 5] }, 0.3] }
            ]
          }
        }
      });

      // project categories + trimmed matchedCatalogItems + useful fields (no matchesBreakdown, no features)
      pipeline.push({
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          rating: 1,
          categories: 1, // top-level categories
          matchedCount: 1,
          coverage: 1,
          _score: 1,
          avgPrice: 1,
          hasAllStock: 1,
          // trimmed matched catalog items (reduce payload)
          matchedCatalogItems: {
            $map: {
              input: (checkStock ? '$matchedWithStock' : '$matched'),
              as: 'mc',
              in: {
                itemId: { $toString: '$$mc.itemId' },
                name: '$$mc.name',
                price: '$$mc.price',
                stock: '$$mc.stock'
              }
            }
          },
          matchedItemIds: {
            $map: {
              input: (checkStock ? '$matchedWithStock' : '$matched'),
              as: 'm',
              in: { $toString: '$$m.itemId' }
            }
          },
          topMatchedCategories: 1 // top-level only
        }
      });

      pipeline.push({ $sort: { _score: -1, hasAllStock: -1, avgPrice: 1 } });
      pipeline.push({ $limit: 200 });

      const vendors = await Vendor.aggregate(pipeline);

      const data = vendors.map(v => ({
        name: v.name,
        email: v.email,
        phone: v.phone,
        rating: v.rating,
        categories: v.categories || [],
        matchedCount: v.matchedCount || 0,
        coverage: v.coverage ?? 0,
        _score: Math.round((v._score ?? 0) * 100) / 100,
        avgPrice: v.avgPrice ? Math.round(v.avgPrice * 100) / 100 : null,
        hasAllStock: !!v.hasAllStock,
        matchedCatalogItems: v.matchedCatalogItems || [],
        matchedItemIds: v.matchedItemIds || [],
        topMatchedCategories: v.topMatchedCategories || []
      }));

      return res.json({ success: true, count: data.length, data, meta: { totalRequested } });
    } else {
      // fallback: match by item name (safe, avoids $concat on arrays)
      if (!itemNames.length) return res.json({ success: true, count: 0, data: [], meta: { totalRequested: 0 } });

      // namePatterns already prepared above
      // expression to safely join categories array into a single string ('' if none)
      const categoriesConcatExpr = {
        $reduce: {
          input: { $ifNull: ['$categories', []] },
          initialValue: '',
          in: {
            $cond: [
              { $eq: ['$$value', ''] },
              '$$this',
              { $concat: ['$$value', ' ', '$$this'] }
            ]
          }
        }
      };

      // helper -> array of $regexMatch expressions using pattern string
      const regexMatchArrayForInput = (inputExpr) => namePatterns.map(pat => ({ $regexMatch: { input: inputExpr, regex: pat, options: 'i' } }));

      const pipeline = [];

      // catalogNamesMatched: how many catalog entries match any item pattern (per vendor)
      pipeline.push({
        $addFields: {
          catalogNamesMatched: {
            $size: {
              $filter: {
                input: { $ifNull: ['$catalog', []] },
                as: 'c',
                cond: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: regexMatchArrayForInput('$$c.name'),
                          as: 'm',
                          cond: { $eq: ['$$m', true] }
                        }
                      }
                    },
                    0
                  ]
                }
              }
            }
          },
          catalogTextMatchCount: {
            $size: {
              $filter: {
                input: regexMatchArrayForInput('$catalogText'),
                as: 'm',
                cond: { $eq: ['$$m', true] }
              }
            }
          },
          categoryMatchCount: {
            $size: {
              $filter: {
                input: regexMatchArrayForInput(categoriesConcatExpr),
                as: 'm',
                cond: { $eq: ['$$m', true] }
              }
            }
          }
        }
      });

      // compute topMatchedCategories (list of vendor categories that matched item names)
      if (namePatterns.length > 0) {
        pipeline.push({
          $addFields: {
            topMatchedCategories: {
              $filter: {
                input: { $ifNull: ['$categories', []] },
                as: 'cat',
                cond: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: namePatterns.map(p => ({ $regexMatch: { input: '$$cat', regex: p, options: 'i' } })),
                          as: 'm',
                          cond: { $eq: ['$$m', true] }
                        }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        });
      } else {
        pipeline.push({ $addFields: { topMatchedCategories: [] } });
      }

      pipeline.push({
        $addFields: {
          matchedCount: { $add: ['$catalogNamesMatched', '$catalogTextMatchCount', '$categoryMatchCount'] }
        }
      });

      if (mode === 'all') {
        pipeline.push({ $match: { matchedCount: { $gte: itemNames.length } } });
      } else {
        pipeline.push({ $match: { matchedCount: { $gt: 0 } } });
      }

      // scoring
      pipeline.push({
        $addFields: {
          coverage: { $min: [{ $divide: ['$matchedCount', itemNames.length] }, 1] },
          ratingNorm: {
            $cond: [
              { $and: [{ $ne: ['$rating', null] }, { $gte: ['$rating', 0] }] },
              { $min: ['$rating', 5] },
              0
            ]
          }
        }
      });

      pipeline.push({
        $addFields: {
          _score: {
            $add: [
              { $multiply: ['$coverage', 0.7] },
              { $multiply: [{ $divide: ['$ratingNorm', 5] }, 0.3] }
            ]
          }
        }
      });

      // project categories and useful fields (no matchesBreakdown, no features)
      pipeline.push({
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          rating: 1,
          categories: 1, // top-level categories
          matchedCount: 1,
          coverage: 1,
          _score: 1,
          topMatchedCategories: 1 // top-level only
        }
      });

      pipeline.push({ $sort: { _score: -1, matchedCount: -1 } });
      pipeline.push({ $limit: 200 });

      const vendors = await Vendor.aggregate(pipeline);

      const data = vendors.map(v => ({
        name: v.name,
        email: v.email,
        phone: v.phone,
        rating: v.rating,
        categories: v.categories || [],
        matchedCount: v.matchedCount || 0,
        coverage: v.coverage ?? 0,
        _score: Math.round((v._score ?? 0) * 100) / 100,
        topMatchedCategories: v.topMatchedCategories || []
      }));

      return res.json({ success: true, count: data.length, data, meta: { fallback: 'name', itemNames } });
    }
  } catch (err) {
    console.error('getVendorCandidates error', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};

// inside your rfp controller file (where createRFP, confirmRFP, etc. are)
export const listRfpTemplates = async (req, res) => {
  try {
    // optional query params:
    //  q => text search on title
    //  limit => max results (default 50, max 200)
    const q = (req.query.q || "").trim();
    let limit = parseInt(req.query.limit || "50", 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 50;
    limit = Math.min(limit, 200);

    const filter = q ? { title: { $regex: q, $options: "i" } } : {};

    // select only needed fields for dropdown
    const docs = await Rfp.find(filter)
      .sort({ createdAt: -1 }) // newest first
      .limit(limit)
      .select("title description totalBudget budget dueDate status sentTo createdAt")
      .lean();

    const data = docs.map((r) => ({
      id: String(r._id),
      title: r.title || "Untitled RFP",
      // support either totalBudget (server model) or older budget field
      budget: r.totalBudget ?? r.budget ?? null,
      description: r.description ? String(r.description).trim() : "",
      createdAt: r.createdAt || null,
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("listRfpTemplates error:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};
