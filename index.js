require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());

// Import Authentication Routes
const authRoutes = require("./authentication/auth");
app.use("/api", authRoutes);

// User Routes
const userRoutes = require("./user/main");
app.use("/api/v1/user", userRoutes);

//Shop owner routes
const soRoutes = require("./shopowner/main");
app.use("/api/v1/so", soRoutes);

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
