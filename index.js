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

app.use(cors());
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
