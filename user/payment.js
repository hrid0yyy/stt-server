const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "Payment API is working!" });
});

// Function to handle placing an order
const placeOrder = async (userId, address, totalPrice) => {
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
      .insert([{ address, items: itemsJson, price: totalPrice }])
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

async function isCartEmpty(userId) {
  // Validate input
  if (!userId) {
    console.error("userId is required");
    return false; // Default to false if userId is not provided
  }

  try {
    // Fetch the cart items for the given userId
    const { data, error } = await supabase
      .from("cart")
      .select("cartId") // Fetch only the cartId to minimize data
      .eq("userId", userId);

    if (error) {
      console.error("Error fetching cart:", error);
      throw error;
    }

    // Check if the data is empty
    return data.length === 0;
  } catch (error) {
    console.error("Error checking if cart is empty:", error.message);
    return false; // Return false in case of an error
  }
}
const getTotalPrice = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    // Fetch all cart items for the given userId, including book details and discounts
    const { data, error } = await supabase
      .from("cart")
      .select(
        `
        quantity,
        books (
          price,
          discount:discount(discount)
        )
      `
      )
      .eq("userId", userId);

    if (error) {
      console.error("Error fetching data:", error);
      throw new Error("Error fetching data from the database");
    }

    if (!data || data.length === 0) {
      return 0; // If the cart is empty, the total price is 0
    }

    // Calculate the total price
    const totalPrice = data.reduce((total, cartItem) => {
      const basePrice = cartItem.books?.price || 0;
      const discount = cartItem.books?.discount?.discount || 1; // Default no discount
      const discountedPrice = basePrice * discount;
      return total + discountedPrice * cartItem.quantity;
    }, 0);

    return totalPrice;
  } catch (error) {
    console.error("Error calculating total price:", error.message);
    throw error; // Re-throw the error for the calling function to handle
  }
};

const checkStockAvailability = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    // Fetch all cart items for the given userId
    const { data: cartItems, error: cartError } = await supabase
      .from("cart")
      .select(
        `
        bookId,
        quantity,
        books (
          stocks
        )
      `
      )
      .eq("userId", userId);

    if (cartError) {
      console.error("Error fetching cart items:", cartError);
      throw new Error("Error fetching cart items");
    }

    if (!cartItems || cartItems.length === 0) {
      return true; // Cart is empty, so no stock issues
    }

    // Check if any item's quantity exceeds available stock
    return !cartItems.some((item) => item.quantity > (item.books?.stocks || 0));
  } catch (error) {
    console.error("Error checking stock availability:", error.message);
    throw error; // Re-throw the error for the calling function to handle
  }
};
const deductStock = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    // Fetch all cart items for the given userId
    const { data: cartItems, error: cartError } = await supabase
      .from("cart")
      .select(
        `
        bookId,
        quantity,
        books (
          stocks
        )
      `
      )
      .eq("userId", userId);

    if (cartError) {
      console.error("Error fetching cart items:", cartError);
      throw new Error("Error fetching cart items");
    }

    if (!cartItems || cartItems.length === 0) {
      console.log("Cart is empty, no stock to deduct");
      return true; // If cart is empty, there's nothing to deduct
    }

    // Deduct stock for each book
    for (const item of cartItems) {
      const currentStock = item.books?.stocks || 0;

      if (item.quantity > currentStock) {
        throw new Error(
          `Insufficient stock for bookId ${item.bookId}. Available: ${currentStock}, Requested: ${item.quantity}`
        );
      }

      const newStock = currentStock - item.quantity;

      // Update the stock in the books table
      const { error: updateError } = await supabase
        .from("books")
        .update({ stocks: newStock })
        .eq("bookId", item.bookId);

      if (updateError) {
        console.error(
          `Error updating stock for bookId ${item.bookId}:`,
          updateError
        );
        throw new Error("Error updating stock");
      }
    }

    console.log("Stock successfully updated for all items");
    return true; // Stock deduction was successful
  } catch (error) {
    console.error("Error deducting stock:", error.message);
    throw error; // Re-throw the error for the calling function to handle
  }
};

const isEligible = async (userId) => {
  const isEmpty = await isCartEmpty(userId);
  const totalPrice = await getTotalPrice(userId);
  const isAvailable = await checkStockAvailability(userId);

  if (isEmpty) {
    return { success: false, error: "Cart is empty" };
  }
  if (!isAvailable) {
    return { success: false, error: "Limitation of stock" };
  }
  return { success: true, totalPrice };
};

router.post("/place-order", async (req, res) => {
  const { userId, location } = req.body;

  if (!userId || !location) {
    return res.status(400).json({
      success: false,
      error: "userId and location are required",
    });
  }

  try {
    // Check if the user is eligible
    const data = await isEligible(userId);

    if (data.success) {
      // Deduct stock
      const stockDeducted = await deductStock(userId);

      if (stockDeducted) {
        // Place the order
        await placeOrder(userId, location);
        return res.status(201).json({
          success: true,
          message: "Order placed successfully",
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Failed to deduct stock",
        });
      }
    }
  } catch (error) {
    console.error("Error placing order:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// after payment process
async () => {
  // "28d7f62a-ba9d-42eb-95fd-a08bf3bafad1"
  const userId = "dmmy";
  const location = "Suvastu, Dhaka";
  const data = await isEligible(userId);
  if (data.success) {
    try {
      const stockDeducted = await deductStock(userId);
      if (stockDeducted) {
        await placeOrder(userId, location, data.totalPrice);
        console.log("Order Placed Successfully");
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
  } else {
    console.log(data);
  }
};

module.exports = router;
