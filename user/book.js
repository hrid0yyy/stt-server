const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "User book API is working!" });
});
router.get("/fetch", async (req, res) => {
  try {
    let { sort, search } = req.body;
    let query = supabase.from("books").select("*");

    // Apply search filter
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,genres.ilike.%${search}%,characters.ilike.%${search}%,attributes.ilike.%${search}%,author.ilike.%${search}%`
      );
    }

    // Apply sorting condition
    if (sort === "asc") {
      query = query.order("price", { ascending: true });
    } else if (sort === "desc") {
      query = query.order("price", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({ success: true, books: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
