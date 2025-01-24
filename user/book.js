const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "User book API is working!" });
});
router.post("/fetch", async (req, res) => {
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
router.post("/details", async (req, res) => {
  try {
    const { bookId, userId } = req.body;

    if (!bookId) {
      return res
        .status(400)
        .json({ success: false, error: "Book ID is required" });
    }

    // Fetch book details
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("*")
      .eq("bookId", bookId);

    if (bookError) {
      throw bookError;
    }

    if (!book || book.length === 0) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    if (book.length > 1) {
      return res.status(400).json({
        success: false,
        error: "Multiple books found for the same ID",
      });
    }

    const bookDetails = book[0]; // Extract the first (and only) book

    // Fetch discount details
    const { data: discountData, error: discountError } = await supabase
      .from("discount")
      .select("discount, end")
      .eq("bookId", bookId);

    if (discountError) {
      throw discountError;
    }

    let discount = false;
    let discountedPrice = null;
    let endDate = null;
    let percentage = null;

    if (discountData && discountData.length > 0) {
      const discountDetails = discountData[0]; // Extract the first discount record
      discount = true;
      discountedPrice = bookDetails.price * discountDetails.discount; // Apply discount
      endDate = discountDetails.end;
      percentage = Math.round((1 - discountDetails.discount) * 100);
    }

    // Check if the book is in the wishlist
    let wishlist = false;

    if (userId) {
      const { data: wishlistData, error: wishlistError } = await supabase
        .from("wishlist")
        .select("*")
        .eq("bookId", bookId)
        .eq("userId", userId)
        .single(); // Expect only one row if it exists

      if (wishlistError && wishlistError.code !== "PGRST116") {
        // "PGRST116" corresponds to no rows found, which is acceptable
        throw wishlistError;
      }

      wishlist = !!wishlistData; // True if a wishlist entry exists
    }

    // Construct the response
    res.status(200).json({
      success: true,
      book: {
        ...bookDetails,
        discount,
        discountedPrice,
        endDate,
        percentage,
        wishlist,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/wishlist/toggle", async (req, res) => {
  try {
    const { bookId, userId } = req.body;

    // Validate the inputs
    if (!bookId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Both bookId and userId are required",
      });
    }

    // Check if the row exists
    const { data: existingWishlist, error: fetchError } = await supabase
      .from("wishlist")
      .select("*")
      .eq("bookId", bookId)
      .eq("userId", userId)
      .single(); // Expect only one row if it exists

    if (fetchError && fetchError.code !== "PGRST116") {
      // "PGRST116" corresponds to no rows found (acceptable here)
      throw fetchError;
    }

    if (existingWishlist) {
      // If the row exists, delete it
      const { error: deleteError } = await supabase
        .from("wishlist")
        .delete()
        .eq("bookId", bookId)
        .eq("userId", userId);

      if (deleteError) {
        throw deleteError;
      }

      return res.status(200).json({
        success: true,
        message: "Book removed from wishlist",
      });
    }

    // If the row doesn't exist, insert it
    const { data: insertedData, error: insertError } = await supabase
      .from("wishlist")
      .insert([{ bookId, userId }]);

    if (insertError) {
      throw insertError;
    }

    res.status(200).json({
      success: true,
      message: "Book added to wishlist",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/rate", async (req, res) => {
  try {
    const { bookId, userId, star, review } = req.body;

    // Validate the required inputs
    if (!bookId || !userId || star === undefined) {
      return res.status(400).json({
        success: false,
        error: "bookId, userId, and star are required fields.",
      });
    }

    // Check if a rating already exists for the book and user
    const { data: existingRating, error: fetchError } = await supabase
      .from("ratings")
      .select("*")
      .eq("bookId", bookId)
      .eq("userId", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // Ignore "PGRST116" (no rows found); other errors should be handled
      throw fetchError;
    }

    if (existingRating) {
      // If a row exists, update it with the new data
      const { error: updateError } = await supabase
        .from("ratings")
        .update({ star, review })
        .eq("bookId", bookId)
        .eq("userId", userId);

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({
        success: true,
        message: "Rating updated successfully",
      });
    }

    // If no row exists, insert a new one
    const { error: insertError } = await supabase
      .from("ratings")
      .insert([{ bookId, userId, star, review }]);

    if (insertError) {
      throw insertError;
    }

    res.status(200).json({
      success: true,
      message: "Rating added successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// search query remaining
router.get("/get_wishlist", async (req, res) => {
  try {
    const { userId, search } = req.query;

    // Ensure userId is provided
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Build the query
    let query = supabase
      .from("wishlist")
      .select("*, books(*)") // Fetch wishlist with book details
      .eq("userId", userId); // Filter rows based on userId

    // If a search parameter is provided, apply it to the book title
    if (search) {
      query = query.ilike("books.title", `%${search}%`); // Case-insensitive partial match
    }

    // Execute the query
    const { data, error } = await query;

    // Handle errors during the query
    if (error) {
      console.error("Error fetching wishlist:", error);
      return res.status(500).json({ error: "Error fetching wishlist" });
    }

    // Return the fetched wishlist data
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in get_wishlist route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/reviews", async (req, res) => {
  try {
    const { bookId } = req.body;

    // Fetch reviews for the given bookId
    const { data: reviews, error: fetchError } = await supabase
      .from("ratings")
      .select(
        "ratingId, star, review, created_at, users (id, full_name, profile_url)"
      )
      .eq("bookId", bookId) // Filter by bookId
      .neq("review", "") // Ensure review is not empty
      .order("created_at", { ascending: false }); // Sort latest to oldest

    if (fetchError) {
      throw fetchError;
    }

    const { data: totalReviews } = await supabase
      .from("ratings")
      .select("ratingId, star, review, created_at")
      .eq("bookId", bookId); // Filter by bookId

    // Calculate totalRatings and avgRatings
    const totalRatings = totalReviews.length;
    const avgRatings =
      totalRatings > 0
        ? totalReviews.reduce((sum, review) => sum + review.star, 0) /
          totalRatings
        : 0;

    // Respond with the reviews, totalRatings, and avgRatings
    res.status(200).json({
      success: true,
      reviews,
      totalRatings,
      avgRatings: avgRatings.toFixed(1), // Format to 2 decimal places
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/purchase-history", async (req, res) => {
  const { userId } = req.query; // Get userId from query parameters

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "userId is required",
    });
  }

  try {
    // Query Supabase for orders by userId with status 'Delivered'
    const { data, error } = await supabase
      .from("order") // 'orders' is the name of the table
      .select("*") // Select all columns
      .eq("status", "Delivered") // Only get orders with status 'Delivered'
      .eq("userId", userId)
      .order("orderDate", { ascending: false }); // Filter by user_id

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Purchase History Found",
      });
    }

    // Enrich each order's items by adding book data
    const enrichedOrders = await Promise.all(
      data.map(async (order) => {
        const enrichedOrder = await enrichOrderItems(order);
        return enrichedOrder;
      })
    );

    // Send the enriched orders back in the response
    return res.status(200).json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (error) {
    console.error(
      "Error fetching purchase history from Supabase:",
      error.message
    );
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

router.get("/track-order", async (req, res) => {
  const { userId } = req.query; // Get userId from query parameters

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "userId is required",
    });
  }

  try {
    // Query Supabase for orders by userId
    const { data, error } = await supabase
      .from("order") // 'orders' is the name of the table
      .select("*") // Select all columns
      .neq("status", "Delivered")
      .eq("userId", userId)
      .order("orderDate", { ascending: false }); // Filter by user_id

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this user",
      });
    }

    // Enrich order items by getting book data
    const enrichedOrders = await Promise.all(
      data.map(async (order) => {
        const enrichedOrder = await enrichOrderItems(order);
        return enrichedOrder;
      })
    );

    // Send the orders back in the response
    return res.status(200).json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (error) {
    console.error("Error fetching orders from Supabase:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

const enrichOrderItems = async (order) => {
  try {
    // Check if 'items' field is valid
    if (!order.items || typeof order.items !== "string") {
      console.error("Invalid or missing items field:", order);
      return { ...order, items: [] }; // Return an empty items array if invalid
    }

    // Parse the stringified 'items' array
    const items = JSON.parse(order.items);

    // Get all bookIds from the items array
    const bookIds = items.map((item) => item.bookId);

    // Query the 'books' table to fetch book details by bookId
    const { data: books, error } = await supabase
      .from("books")
      .select("bookId, title, cover")
      .in("bookId", bookIds); // Filter by multiple bookIds

    if (error) {
      throw error;
    }

    // Map the book details to the corresponding items in the order
    const enrichedItems = items.map((item) => {
      const book = books.find((b) => b.bookId === item.bookId);
      return {
        ...item,
        title: book ? book.title : "Unknown Title",
        cover: book ? book.cover : "Unknown Cover",
        bookId: book ? book.bookId : "Unknown BookId",
      };
    });

    // Return the updated order with enriched items
    return {
      ...order,
      items: enrichedItems,
    };
  } catch (error) {
    console.error("Error enriching order items:", error.message);
    throw error;
  }
};

module.exports = router;
