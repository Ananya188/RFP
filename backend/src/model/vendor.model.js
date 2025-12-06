// model/vendor.model.js
import mongoose from "mongoose";

const CatalogItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: false }, // optional: can be string too
  name: { type: String, required: false }, // keep name for name-based fallback
  price: { type: Number, default: null },
  stock: { type: Number, default: null },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  contactName: { type: String },
  email: { type: String, required: true, index: true },
  phone: { type: String },
  categories: [{ type: String }],
  catalogText: { type: String },
  address: { type: String },
  rating: { type: Number, default: null },
  catalog: { type: [CatalogItemSchema], default: [] }, // <-- new
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const Vendor = mongoose.model("Vendor", VendorSchema);
export default Vendor;
