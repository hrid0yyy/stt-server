const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();

// Authentication Route
router.get("/", (req, res) => {
  res.json({ message: "Shop owner book API is working!" });
});

// Add a new book
router.post("/add", async (req, res) => {
  try {
    const {
      title,
      publisher,
      page,
      stocks,
      description,
      genres,
      cover,
      pubDate,
      language,
      price,
      characters,
      author,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !publisher ||
      !page ||
      !stocks ||
      !description ||
      !genres ||
      !cover ||
      !pubDate ||
      !language ||
      !price ||
      !characters ||
      !author
    ) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required" });
    }

    const { error } = await supabase.from("books").insert([
      {
        title,
        publisher,
        page,
        stocks,
        description,
        genres,
        cover,
        pubDate,
        language,
        price,
        characters,
        author,
      },
    ]);

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch all books
router.get("/fetch", async (req, res) => {
  try {
    const { data, error } = await supabase.from("books").select("*");

    if (error) {
      throw error;
    }
    res.status(200).json({ books: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update attributes by concatenating a new item
router.put("/update-attribute", async (req, res) => {
  try {
    const { bookId, newAttribute } = req.body;

    if (!bookId || !newAttribute) {
      return res.status(400).json({
        success: false,
        error: "bookId and newAttribute are required",
      });
    }

    // Fetch the current attributes
    const { data: bookData, error: fetchError } = await supabase
      .from("books")
      .select("attributes")
      .eq("bookId", bookId)
      .single();

    if (fetchError) throw fetchError;

    let existingAttributes = bookData?.attributes || "";

    // Ensure proper concatenation: add a comma if not empty
    let updatedAttributes = existingAttributes
      ? `${existingAttributes}, ${newAttribute}`
      : newAttribute;

    // Update the attributes column
    const { data, error } = await supabase
      .from("books")
      .update({ attributes: updatedAttributes.trim() })
      .eq("bookId", bookId)
      .select("*");

    if (error) throw error;

    res.status(200).json({ success: true, book: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search books by attribute (partial match)
router.get("/search-by-attribute", async (req, res) => {
  try {
    const { attribute } = req.body;

    if (!attribute) {
      return res
        .status(400)
        .json({ success: false, error: "Attribute is required" });
    }

    // Search for books where attributes column contains the given attribute
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .ilike("attributes", `%${attribute}%`); // Partial match search

    if (error) throw error;

    res.status(200).json({ success: true, books: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset attributes to an empty string
router.put("/clear-attribute", async (req, res) => {
  try {
    const { bookId } = req.body;

    if (!bookId) {
      return res
        .status(400)
        .json({ success: false, error: "bookId is required" });
    }

    // Update the attributes column to an empty string
    const { data, error } = await supabase
      .from("books")
      .update({ attributes: "" })
      .eq("bookId", bookId)
      .select("*");

    if (error) throw error;

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
