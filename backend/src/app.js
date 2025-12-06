import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import rfpRouter from "./router/rfp.routes.js";
import venderRouter from "./router/vender.router.js";
import connectDB from "../config/db.js";
import emailRoutes from "./router/email.routes.js";

const app = express();

app.use(cors());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}));
connectDB();

app.use("/api/rfp",rfpRouter);
app.use("/api/vendor",venderRouter)
app.use("/api/email",emailRoutes);

app.get("/test-error", (req, res, next) => {
  const err = new Error("Something failed!");
  err.statusCode = 400;
  next(err);  // ⬅ passes error to middleware
});


app.use((err,req,res,next)=>{
    console.error("Error:",err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
})

export default app;