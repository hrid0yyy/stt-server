require("dotenv").config();
const express = require("express");
const supabase = require("./config/supabase"); // Your Supabase client configuration
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

//utils routes
const utils = require("./utils/main");
app.use("/api/v1/utils", utils);

// Default Route
app.get("/", (req, res) => {
  res.send("Welcome To SHELF TO TALES Server!");
});

app.get("/stats", async (req, res) => {
  try {
    // Query to get the total number of users
    const { count: userCount, error: userError } = await supabase
      .from("users")
      .select("id", { count: "exact" });

    if (userError) {
      throw userError;
    }

    // Query to get the total number of books
    const { count: bookCount, error: bookError } = await supabase
      .from("books")
      .select("bookId", { count: "exact" });

    if (bookError) {
      throw bookError;
    }

    // Query to get the total number of eBooks
    const { count: ebookCount, error: ebookError } = await supabase
      .from("eBooks")
      .select("bookId", { count: "exact" });

    if (ebookError) {
      throw ebookError;
    }

    // Sending response with the total counts
    res.status(200).json({
      totalUsers: userCount,
      totalBooks: bookCount,
      totalEbooks: ebookCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

try {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Server failed to start:", error);
}
