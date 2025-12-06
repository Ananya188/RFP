import Vendor from "../model/vendor.model.js";
import formatMongooseError from "../services/errorHandles.js";

/**
 * Helper to format mongoose errors into a consistent response:
 * - ValidationError -> { fieldName: "message", ... }
 * - MongoServerError duplicate key -> { field: "duplicate value" }
 */

/* create vendor */
export const createVendor = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload?.name || !payload?.email) {
      return res.status(400).json({ success: false, message: 'name and email required' });
    }
    const v = new Vendor(payload);
    const saved = await v.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('createVendor error', err);

    const formatted = formatMongooseError(err);
    return res.status(formatted.status).json({
      success: false,
      message: formatted.message,
      ...(formatted.details ? { details: formatted.details } : {})
    });
  }
};

/* list / search vendors */
export const listVendors = async (req, res) => {
  try {
    const { q, limit = 100, page = 1 } = req.query;
    const filter = {};
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ name: regex }, { catalogText: regex }, { categories: regex }, { email: regex }];
    }
    const lim = Math.min(Math.max(Number(limit) || 100, 1), 1000);
    const pg = Math.max(Number(page) || 1, 1);
    const skip = (pg - 1) * lim;
    const vendors = await Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim);
    return res.json({ success: true, data: vendors, meta: { page: pg, limit: lim } });
  } catch (err) {
    console.error('listVendors error', err);
    const formatted = formatMongooseError(err);
    return res.status(formatted.status).json({ success: false, message: formatted.message });
  }
};

/* get */
export const getVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    return res.json({ success: true, data: vendor });
  } catch (err) {
    console.error('getVendor error', err);
    const formatted = formatMongooseError(err);
    return res.status(formatted.status).json({
      success: false,
      message: formatted.message,
      ...(formatted.details ? { details: formatted.details } : {})
    });
  }
};

/* update */
export const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // runValidators and context:'query' so mongoose validators (required, enum, custom) run on update
    const vendor = await Vendor.findByIdAndUpdate(id, updates, { new: true, runValidators: true, context: 'query' });

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    return res.json({ success: true, data: vendor });
  } catch (err) {
    console.error('updateVendor error', err);
    const formatted = formatMongooseError(err);
    return res.status(formatted.status).json({
      success: false,
      message: formatted.message,
      ...(formatted.details ? { details: formatted.details } : {})
    });
  }
};

/* delete */
export const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findByIdAndDelete(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    return res.json({ success: true, message: 'Vendor deleted' });
  } catch (err) {
    console.error('deleteVendor error', err);
    const formatted = formatMongooseError(err);
    return res.status(formatted.status).json({ success: false, message: formatted.message });
  }
};


