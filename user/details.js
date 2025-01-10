const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "User details API is working!" });
});

// To get user details
router.post("/details", async (req, res) => {
  try {
    // Extract token from request body
    const { token } = req.body;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }

    // Check if token is still valid
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired token" });
    }

    const id = data.user.id;

    if (!id) {
      return res.status(400).json({ success: false, error: "Id is required!" });
    }

    // Fetch user from Supabase
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return res.status(401).json({ success: false, error: "Invalid ID" });
      }

      return res.json({ success: true, user: data });
    } catch (err) {
      res.status(500).json({ success: false, details: err.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, details: err.message });
  }
});

router.put("/update", async (req, res) => {
  // example json
  // {
  //   "id": "user-123",
  //   "updates": { "username": "JohnDoe" }
  // }
  const { id, updates } = req.body;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: "User ID is required!" });
  }

  if (!updates || Object.keys(updates).length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "No fields to update!" });
  }

  try {
    // Update user details dynamically
    const { data, error } = await supabase
      .from("users")
      .update(updates) // Pass the updates object directly
      .eq("id", id)
      .select("*"); // Returns the updated row

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: "User updated successfully!",
      user: data,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
