import express from "express";
import { confirmRFP, createRFP, getVendorCandidates, listRfpTemplates, sendRFPToVendors } from "../controller/rfp.controller.js";
import { compareProposalsForRfp } from "../controller/compare.controller.js";
import { aiRecommendForRfp } from "../controller/aiRecommend.controller.js";
import { checkOpenAIStatus } from "../services/aiRfpExtractor.js";

const rfpRouter = express.Router();

rfpRouter.post("/",createRFP);
rfpRouter.put("/:id/confirm",confirmRFP);
rfpRouter.get("/templates",listRfpTemplates)

rfpRouter.get("/:id/candidates",getVendorCandidates)
rfpRouter.post("/:id/send",sendRFPToVendors);

rfpRouter.get("/:id/compare",compareProposalsForRfp)

rfpRouter.get("/:id/ai",aiRecommendForRfp)

rfpRouter.get("/status", async (req, res) => {
  const result = await checkOpenAIStatus();
  res.json(result);
})

export default rfpRouter;