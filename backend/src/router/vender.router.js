import express from "express";
import { createVendor, deleteVendor, getVendor, listVendors, updateVendor } from "../controller/vender.controller.js";


const venderRouter = express.Router();

venderRouter.post("/createVendor",createVendor)
venderRouter.get("/list",listVendors);
venderRouter.get("/:id",getVendor);
venderRouter.put("/:id",updateVendor);
venderRouter.delete("/:id",deleteVendor);

export default venderRouter;