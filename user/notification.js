const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "user notification book API is working!" });
});

router.get("/fetch/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch all notifications for the user
    const { data: notifications, error: fetchError } = await supabase
      .from("notification") // Replace with your exact table name
      .select("*")
      .eq("userId", userId);

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch notifications" });
    }

    // Count rows where status = 'unseen' for the user
    const { count: totalUnseen, error: countError } = await supabase
      .from("notification")
      .select("id", { count: "exact" }) // Specify 'id' or any column to count
      .eq("userId", userId)
      .eq("status", "unseen");

    if (countError) {
      console.error("Error counting unseen notifications:", countError);
      return res.status(500).json({
        success: false,
        error: "Failed to count unseen notifications",
      });
    }

    // Send the response
    res.status(200).json({
      success: true,
      data: notifications,
      totalUnseen: totalUnseen || 0, // Provide a default value of 0 if no unseen notifications
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res
      .status(500)
      .json({ success: false, error: "An unexpected error occurred" });
  }
});

module.exports = router;
