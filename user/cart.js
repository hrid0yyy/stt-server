const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "Cart API is working!" });
});

// Route to insert a book into the cart
router.post("/add", async (req, res) => {
  const { userId, bookId } = req.body;

  // Validate request body
  if (!userId || !bookId) {
    return res
      .status(400)
      .json({ success: false, error: "userId and bookId are required" });
  }

  try {
    const { error } = await supabase
      .from("cart") // Ensure "cart" table exists in Supabase
      .insert([{ userId: userId, bookId: bookId }]);

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to add, update, or delete a book from the cart
router.post("/update", async (req, res) => {
  const { userId, bookId, quantity } = req.body;

  // Validate request body
  if (!userId || !bookId || typeof quantity !== "number") {
    return res.status(400).json({
      success: false,
      error: "userId, bookId, and quantity are required",
    });
  }

  try {
    // If quantity is 0 or less, remove the item from the cart
    if (quantity <= 0) {
      const { error: deleteError } = await supabase
        .from("cart")
        .delete()
        .eq("userId", userId)
        .eq("bookId", bookId);

      if (deleteError) throw deleteError;

      return res.json({ success: true });
    }

    // Update quantity if book is already in cart
    const { data, error: updateError } = await supabase
      .from("cart")
      .update({ quantity })
      .eq("userId", userId)
      .eq("bookId", bookId);

    if (updateError) throw updateError;

    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/fetch", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, error: "userId is required" });
  }

  try {
    // Fetch all cart items for the given userId
    const { data, error } = await supabase
      .from("cart")
      .select("*, books(*)")
      .eq("userId", userId);

    if (error) throw error;

    if (data.length === 0) {
      return res.json({ success: true, cart: [] });
    }

    res.json({ success: true, cart: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
