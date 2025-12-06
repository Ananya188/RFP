// models/proposal.model.js
import mongoose from 'mongoose';

const LineItemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  price: Number,
  specs: mongoose.Schema.Types.Mixed
}, { _id: false });

const ProposalSchema = new mongoose.Schema({
  rfp: { type: mongoose.Schema.Types.ObjectId, ref: 'RFP', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: false }, // optional if unknown
  vendorEmail: { type: String, required: true },
  vendorName: String,
  totalPrice: Number,
  currency: String,
  lineItems: [LineItemSchema],
  terms: String,
  rawText: String,         // full vendor email text
  attachments: [{ filename: String, contentType: String, size: Number, storedAs: String }], // storedAs: path or base64 tag
  receivedAt: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed,
  score: Number
}, { timestamps: true });

const Proposal = mongoose.model("Proposal",ProposalSchema);

export default Proposal;