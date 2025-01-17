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
  const { cartId, operation } = req.body;

  // Validate request body
  if (!cartId || !["plus", "minus"].includes(operation)) {
    return res.status(400).json({
      success: false,
      error: "cartId and valid operation (plus/minus) are required",
    });
  }

  try {
    // Fetch the current quantity for the given cartId
    const { data: cartItem, error: fetchError } = await supabase
      .from("cart")
      .select("quantity")
      .eq("cartId", cartId)
      .single();

    if (fetchError) throw fetchError;

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        error: "Item not found in the cart",
      });
    }

    let newQuantity = cartItem.quantity;

    // Adjust the quantity based on the operation
    if (operation === "plus") {
      newQuantity += 1;
    } else if (operation === "minus") {
      newQuantity -= 1;
    }

    // If quantity becomes zero or less, delete the item from the cart
    if (newQuantity <= 0) {
      const { error: deleteError } = await supabase
        .from("cart")
        .delete()
        .eq("cartId", cartId);

      if (deleteError) throw deleteError;

      return res.json({ success: true, message: "Item removed from the cart" });
    }

    // Update the cart with the new quantity
    const { error: updateError } = await supabase
      .from("cart")
      .update({ quantity: newQuantity })
      .eq("cartId", cartId);

    if (updateError) throw updateError;

    return res.json({ success: true, message: "Cart updated successfully" });
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
    // Fetch all cart items for the given userId, including book details and discounts
    const { data, error } = await supabase
      .from("cart")
      .select(
        `
        bookId,
        quantity,
        userId,
        added_at,
        cartId,
        books (
          title,
          cover,
          price,
          author,
          discount:discount(discount)
        )
      `
      )
      .eq("userId", userId);

    if (error) {
      console.error("Error fetching data:", error);
      throw new Error("Error fetching data from the database");
    }

    // Map the data to include price adjustments and calculate the total price
    let totalPrice = 0;

    const formattedData = data.map((cartItem) => {
      const basePrice = cartItem.books?.price || 0;
      const discount = cartItem.books?.discount?.discount || 1; // Default no discount (1 means no discount)
      const discountedPrice = basePrice * discount; // Apply discount
      const itemTotal = discountedPrice * cartItem.quantity; // Total for this cart item

      totalPrice += itemTotal; // Add to total price of the cart

      return {
        bookId: cartItem.bookId,
        quantity: cartItem.quantity,
        userId: cartItem.userId,
        author: cartItem.books.author,
        added_at: cartItem.added_at,
        cartId: cartItem.cartId,
        title: cartItem.books?.title || null,
        cover: cartItem.books?.cover || null,
        price: discountedPrice, // Final price after discount
        itemTotal, // Total price for this item
      };
    });

    // If no data, return an empty cart with totalPrice 0
    if (data.length === 0) {
      return res.json({ success: true, cart: [], totalPrice: 0 });
    }

    // Return formatted data with total price
    res.json({ success: true, cart: formattedData, totalPrice });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
