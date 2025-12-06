import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  specs: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const RfpSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },  // natural language request
  items: { type: [ItemSchema], default: [] },
  totalBudget: { type: Number, default: 0 },
  deliveryDays: { type: Number, default: null },
  paymentTerms: { type: String, default: "" },
  warrantyMonths: { type: Number, default: 0 },

  // single-user audit (keeps things simple)
  createdBy: { type: String, default: process.env.ADMIN_EMAIL || "admin@local" },
}, {
  timestamps: true // createdAt, updatedAt
});

// small helpers for convenience
RfpSchema.methods.addItem = function (item) {
  this.items.push(item);
  return this.save();
};

RfpSchema.methods.removeItemByName = function (name) {
  this.items = this.items.filter(i => i.name !== name);
  return this.save();
};


const Rfp = mongoose.model('RFP', RfpSchema)

export default Rfp;