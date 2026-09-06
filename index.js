const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { connectDb } = require("./utils/connect_db");
const errorHandler = require("./middlewares/errorHandler");
const lineRoutes = require("./routes/lineRoutes");
const shopRoutes = require("./routes/shopRoutes");
const snackRoutes = require("./routes/snackRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");

const app = express();
dotenv.config();
const PORT = process.env.PORT || 3001;
connectDb(process.env.MongoDbUrl);

// Configure CORS to support specific allowed origins and credentials
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : null;

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl)
        if (!origin) return callback(null, true);
        if (!allowedOrigins) return callback(null, true); // allow all if not configured
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    credentials: true,
};

app.use(cors(corsOptions));
// Use a "/*" pattern for preflight to avoid path-to-regexp parsing errors
app.options("/*", cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

// Handle favicon requests to avoid unnecessary 500s from missing static asset
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.use("/api/line", lineRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/snack", snackRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
