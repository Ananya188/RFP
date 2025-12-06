import express from "express";
import { fetchAndProcessEmails, previewParse, reprocessProposal } from "../controller/email.controller.js";


const emailRoutes = express.Router();

emailRoutes.post("/fetch",fetchAndProcessEmails)
emailRoutes.post("/preview",previewParse)
emailRoutes.post("/:id/reprocess",reprocessProposal);



export default emailRoutes;