const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const supabase = require("./supabaseClient"); // Import Supabase client
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Import exchange book routes
const exchangeBookRoutes = require("./exchangeBooks");

// Use the exchange book routes
app.use("/exchange", exchangeBookRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Express Server is running!" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Insert data into a specified table
app.post("/data", async (req, res) => {
  const { table, data } = req.body;

  // Basic validation
  if (!table || !data) {
    return res.status(400).json({
      error: "Please provide 'table' and 'data' in the request body.",
    });
  }

  try {
    const { error } = await supabase.from(table).insert(data);
    if (error) throw error;

    return res.status(200).json({ message: "Data inserted successfully" });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Fetch data from a specified table
app.get("/data", async (req, res) => {
  const { table } = req.query; // e.g., GET /data?table=users

  // Check if a table name is provided
  if (!table) {
    return res
      .status(400)
      .json({ error: "Please provide a 'table' query parameter." });
  }

  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
