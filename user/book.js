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

module.exports = router;
