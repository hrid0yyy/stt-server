const express = require("express");
const supabase = require("./supabaseClient"); // Import Supabase client

const router = express.Router();

// API to fetch exchange_books data excluding the provided userId
router.get("/exchange-books", async (req, res) => {
  const { userId } = req.query;

  // Validate the input
  if (!userId) {
    return res
      .status(400)
      .json({ error: "Missing required query parameter: userId." });
  }

  try {
    // Fetch data from the `exchange_books` table excluding rows with the provided userId
    const { data, error } = await supabase
      .from("exchange_books")
      .select("*")
      .neq("userId", userId); // Exclude rows where userId equals the provided userId

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
