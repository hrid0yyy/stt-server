require("dotenv").config();
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

const SSLCommerzPayment = require("sslcommerz-lts");

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; //true for live, false for sandbox

router.get("/init", async (req, res) => {
  try {
    const userId = req.query.userId; // Retrieve userId from query parameters
    const location = req.query.location;
    const number = req.query.number;
    const full_name = req.query.full_name;
    const email = req.query.email;
    console.log(location, number, full_name, email);
    console.log("User ID:", userId);
    // Call isEligible and wait for the result
    const eligibilityResponse = await isEligible(userId);
    console.log(eligibilityResponse);
    if (!eligibilityResponse.success) {
      // If not eligible, respond with the error message
      return res
        .status(400)
        .send({ success: false, message: eligibilityResponse.message });
    }

    const tranId = `${userId}_${Date.now()}`;
    console.log(tranId);
    // Use the total price from the eligibility response
    const data = {
      total_amount: eligibilityResponse.totalPrice,
      currency: "BDT",
      tran_id: tranId, // Use unique tran_id for each API call
      success_url: "http://localhost:3030/success",
      fail_url: "http://localhost:3030/fail",
      cancel_url: "http://localhost:3030/cancel",
      ipn_url: "http://localhost:3030/ipn",
      shipping_method: "Courier",
      product_name: "Books",
      product_category: "Books",
      product_profile: "Books",
      cus_name: full_name,
      cus_email: email,
      cus_add1: location,
      cus_add2: location,
      cus_city: location,
      cus_state: location,
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: number,
      cus_fax: "01711111111",
      ship_name: full_name,
      ship_add1: location,
      ship_add2: location,
      ship_city: location,
      ship_state: location,
      ship_postcode: 1000,
      ship_country: "Bangladesh",
    };

    // Initialize SSLCommerz payment
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);

    // Redirect the user to the payment gateway
    const GatewayPageURL = apiResponse.GatewayPageURL;
    console.log("Redirecting to:", GatewayPageURL);
    return res.send({ success: true, url: GatewayPageURL });
  } catch (error) {
    console.error("Error in /init endpoint:", error.message);
    return res
      .status(500)
      .send({ success: false, error: "Internal Server Error" });
  }
});

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
      .insert([{ address, items: itemsJson, price: totalPrice, userId }])
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
    return { success: false, message: "Cart is empty" };
  }
  if (!isAvailable) {
    return { success: false, message: "Limitation of stock" };
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
    // Get the total price for the user
    const totalPrice = await getTotalPrice(userId);

    // Check if stock can be deducted
    const stockDeducted = await deductStock(userId);

    if (stockDeducted) {
      // Place the order
      await placeOrder(userId, location, totalPrice);
      console.log("Order placed successfully");

      // Send success response
      return res.status(201).json({
        success: true,
        message: "Order placed successfully",
      });
    } else {
      // If stock deduction failed
      return res.status(400).json({
        success: false,
        error: "Failed to place order",
      });
    }
  } catch (error) {
    console.error("Error placing order:", error.message);
    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      error: "Internal server error",
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

router.get("/init-ebook", async (req, res) => {
  try {
    const userId = req.query.userId; // Retrieve userId from query parameters
    const bookId = req.query.bookId; // Retrieve bookId from query parameters

    console.log("User ID:", userId);
    const user = await getUserDetails(userId);
    const ebook = await getEbookDetails(bookId);

    // get ebook name,price and user details
    const tranId = `${userId}_${Date.now()}`;
    // Use the total price from the eligibility response
    const data = {
      total_amount: ebook.price,
      currency: "BDT",
      tran_id: tranId, // Use unique tran_id for each API call
      success_url: "http://localhost:3030/success",
      fail_url: "http://localhost:3030/fail",
      cancel_url: "http://localhost:3030/cancel",
      ipn_url: "http://localhost:3030/ipn",
      shipping_method: "Courier",
      product_name: ebook.details[0].title,
      product_category: "Books",
      product_profile: "Books",
      cus_name: user.full_name,
      cus_email: user.email,
      cus_add1: user.location,
      cus_add2: user.location,
      cus_city: user.location,
      cus_state: user.location,
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: user.mobile_number,
      cus_fax: "01711111111",
      ship_name: user.full_name,
      ship_add1: user.location,
      ship_add2: user.location,
      ship_city: user.location,
      ship_state: user.location,
      ship_postcode: 1000,
      ship_country: "Bangladesh",
    };

    // Initialize SSLCommerz payment
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);
    //   console.log(apiResponse);
    // Redirect the user to the payment gateway
    const GatewayPageURL = apiResponse.GatewayPageURL;
    console.log("Redirecting to:", GatewayPageURL);
    return res.send({ success: true, url: GatewayPageURL });
  } catch (error) {
    console.error("Error in /init endpoint:", error.message);
    return res
      .status(500)
      .send({ success: false, error: "Internal Server Error" });
  }
});

const getUserDetails = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return false;
    }

    return data[0];
  } catch (error) {
    return false;
  }
};

const getEbookDetails = async (bookId) => {
  try {
    const { data, error } = await supabase
      .from("eBooks") // Querying the eBooks table
      .select("*") // Selecting all columns from eBooks and related rows from books
      .eq("bookId", bookId); // Filtering where bookId matches the provided bookId

    if (error) {
      throw error; // Throwing error if query fails
    }

    if (!data || data.length === 0) {
      return false; // Returning false if no data is found
    }
    const query = await supabase
      .from("books") // Querying the eBooks table
      .select("title") // Selecting all columns from eBooks and related rows from books
      .eq("bookId", bookId); // Filtering where bookId matches the provided bookId

    // Merging the results from both queries
    const result = {
      ...data[0],
      details: query.data, // Including bookData in a nested property
    };
    return result;
  } catch (error) {
    return false; // Returning false if an error is caught
  }
};

module.exports = router;
