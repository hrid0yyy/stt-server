require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());

// Import Authentication Routes
const authRoutes = require("./authentication/auth");
app.use("/api", authRoutes);

// User details Routes
const userDetailsRoutes = require("./user/details");
app.use("/api/user", userDetailsRoutes);

// Shop owner book Routes
const soBookRoutes = require("./shopowner/book");
app.use("/api/so/book", soBookRoutes);

// Shop owner discount Routes
const soDiscount = require("./shopowner/discount");
app.use("/api/so/discount", soDiscount);

// Default Route
app.get("/", (req, res) => {
  res.send("Welcome To SHELF TO TALES Server!");
});

try {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Server failed to start:", error);
}
