const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();

// Authentication Route
router.get("/", (req, res) => {
  res.json({ message: "Shop owner discount API is working!" });
});

// Insert a discount into the "discount" table
router.post("/add", async (req, res) => {
  try {
    const { bookId, discount, start, end } = req.body;

    // Validate required fields
    if (!bookId || discount === undefined || !start || !end) {
      return res.status(400).json({
        success: false,
        error: "bookId, discount, start, and end are required",
      });
    }

    // Validate discount range (0.0 to 1.0)
    if (discount < 0.0 || discount > 1.0) {
      return res.status(400).json({
        success: false,
        error: "Discount must be between 0.0 and 1.0",
      });
    }

    // Validate timestamp order (start must be before end)
    if (new Date(start) >= new Date(end)) {
      return res.status(400).json({
        success: false,
        error: "Start timestamp must be before end timestamp",
      });
    }

    // Insert discount into Supabase
    const { data, error } = await supabase
      .from("discount")
      .insert([
        {
          bookId,
          discount,
          start,
          end,
        },
      ])
      .select("*");

    if (error) throw error;

    res.status(201).json({ success: true, discount: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to continuously check and delete expired discounts
const deleteExpiredDiscounts = async () => {
  try {
    const now = new Date().toISOString();

    // Fetch expired discounts
    const { data: expiredDiscounts, error: fetchError } = await supabase
      .from("discount")
      .select("bookId, end")
      .lt("end", now); // Select rows where 'end' is earlier than now

    if (fetchError) {
      console.error("Error fetching expired discounts:", fetchError);
      return;
    }

    if (expiredDiscounts.length > 0) {
      // Delete expired discounts
      const { error: deleteError } = await supabase
        .from("discount")
        .delete()
        .lt("end", now); // Delete rows where 'end' is earlier than now

      if (deleteError) {
        console.error("Error deleting expired discounts:", deleteError);
      } else {
        console.log(`Deleted ${expiredDiscounts.length} expired discount(s)`);
      }
    }
  } catch (error) {
    console.error("Error in deleteExpiredDiscounts function:", error);
  }
};

// Run the cleanup job every 1 minute (1000 ms)
setInterval(deleteExpiredDiscounts, 1000);

module.exports = router;
