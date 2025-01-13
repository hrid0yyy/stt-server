const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "Payment API is working!" });
});

// Route to insert an order
router.post("/place-order", async (req, res) => {
  const { userId, address } = req.body;

  if (!userId || !address) {
    return res
      .status(400)
      .json({ success: false, error: "userId and address are required" });
  }

  try {
    // Fetch cart items for the user
    const { data: cartItems, error: cartError } = await supabase
      .from("cart")
      .select("bookId, quantity")
      .eq("userId", userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: "Cart is empty" });
    }

    // Convert cart data to JSON format
    const itemsJson = JSON.stringify(cartItems);

    // Insert the order into the orders table
    const { data: orderData, error: orderError } = await supabase
      .from("order")
      .insert([{ address, items: itemsJson }])
      .select("*")
      .single();

    if (orderError) throw orderError;

    // Delete all rows from the cart for that user
    const { error: deleteError } = await supabase
      .from("cart")
      .delete()
      .eq("userId", userId);

    if (deleteError) throw deleteError;

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: orderData,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/total", async (req, res) => {
  try {
    const { userId } = req.body; // Change req.body to req.query for GET request

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "User ID is required" });
    }

    // Fetch cart items for the user
    const { data: cartItems, error: cartError } = await supabase
      .from("cart")
      .select("bookId, quantity")
      .eq("userId", userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return res.status(200).json({ success: true, total_price: 0 });
    }

    // Extract book IDs from cart
    const bookIds = cartItems.map((item) => item.bookId);

    // Fetch book prices, ensure correct column name (e.g., `bookId`)
    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("bookId, price") // Change 'id' to 'bookId' if necessary
      .in("bookId", bookIds);

    if (booksError) throw booksError;

    // Create a price lookup
    const priceMap = {};
    books.forEach((book) => {
      priceMap[book.bookId] = book.price; // Ensure bookId matches
    });

    // Calculate total price
    const totalPrice = cartItems.reduce((total, item) => {
      return total + item.quantity * (priceMap[item.bookId] || 0);
    }, 0);

    res.status(200).json({ success: true, total_price: totalPrice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to get  total price
const getTotalPrice = async (userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Fetch cart items for the user
    const { data: cartItems, error: cartError } = await supabase
      .from("cart")
      .select("bookId, quantity")
      .eq("userId", userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return { success: true, total_price: 0 };
    }

    // Extract book IDs from cart
    const bookIds = cartItems.map((item) => item.bookId);

    // Fetch book prices, ensure correct column name (e.g., `bookId`)
    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("bookId, price") // Change 'id' to 'bookId' if necessary
      .in("bookId", bookIds);

    if (booksError) throw booksError;

    // Create a price lookup
    const priceMap = {};
    books.forEach((book) => {
      priceMap[book.bookId] = book.price; // Ensure bookId matches
    });

    // Calculate total price
    const totalPrice = cartItems.reduce((total, item) => {
      return total + item.quantity * (priceMap[item.bookId] || 0);
    }, 0);

    return { success: true, total_price: totalPrice };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Function to handle placing an order
const placeOrder = async (userId, address) => {
  if (!userId || !address) {
    return { success: false, error: "userId and address are required" };
  }

  try {
    // Fetch cart items for the user
    const { data: cartItems, error: cartError } = await supabase
      .from("cart")
      .select("bookId, quantity")
      .eq("userId", userId);

    if (cartError) throw cartError;

    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Cart is empty" };
    }

    // Convert cart data to JSON format
    const itemsJson = JSON.stringify(cartItems);

    // Insert the order into the orders table
    const { data: orderData, error: orderError } = await supabase
      .from("order")
      .insert([{ address, items: itemsJson }])
      .select("*")
      .single();

    if (orderError) throw orderError;

    // Delete all rows from the cart for that user
    const { error: deleteError } = await supabase
      .from("cart")
      .delete()
      .eq("userId", userId);

    if (deleteError) throw deleteError;

    return {
      success: true,
      message: "Order placed successfully",
      order: orderData,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = router;
