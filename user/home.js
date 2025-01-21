const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "User home API is working!" });
});

router.get("/new_release", async (req, res) => {
  try {
    // Query the books table to fetch the latest 10 books
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false }) // Order by createdAt descending
      .limit(20); // Limit the result to 10 books

    // Handle errors during the query
    if (error) {
      console.error("Error fetching latest books:", error);
      return res.status(500).json({ error: "Error fetching latest books" });
    }

    // Return the fetched books data
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in latest_books route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/discount", async (req, res) => {
  try {
    // Query the books table to fetch the latest 10 books
    const { data, error } = await supabase
      .from("discount")
      .select("*,books(*)")
      .order("discount", { ascending: true }); // Order by createdAt descending

    // Handle errors during the query
    if (error) {
      console.error("Error fetching latest books:", error);
      return res.status(500).json({ error: "Error fetching latest books" });
    }

    // Return the fetched books data
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in latest_books route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
