const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "User profile API is working!" });
});

router.put("/update", async (req, res) => {
  try {
    const { id, ...updateFields } = req.body;

    // Validate the request
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "User ID is required" });
    }

    if (!Object.keys(updateFields).length) {
      return res
        .status(400)
        .json({ success: false, error: "No fields to update" });
    }

    // Update the user in the database
    const { data, error } = await supabase
      .from("users")
      .update(updateFields)
      .eq("id", id)
      .select("*"); // Explicitly request the updated rows

    // Handle Supabase errors
    if (error) {
      console.error("Error updating user:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update user" });
    }

    // Success response
    res.json({
      success: true,
      user: data,
    });
  } catch (error) {
    console.error("Error in update_user route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.get("/get_user", async (req, res) => {
  try {
    const { ownId, userId } = req.query;

    // Ensure userId and ownId are providesd
    if (!userId || !ownId) {
      return res.status(400).json({ error: "userId and ownId are required" });
    }

    // Query the users table for the given userId
    const userQuery = await supabase
      .from("users")
      .select(
        "*,exchange_books(*),wishlist(*,books(*)), posts(*),eb_access(*,books(*))"
      )
      .eq("id", userId);

    if (userQuery.error) {
      console.error("Error fetching user:", userQuery.error);
      return res.status(500).json({ error: "Error fetching user" });
    }

    const userData = userQuery.data;

    // Check if user exists
    if (!userData || userData.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    let iFollow = false;
    let theyFollow = false;

    // Check if ownId follows userId
    const followQuery1 = await supabase
      .from("follow")
      .select("*")
      .eq("follower", ownId)
      .eq("following", userId);

    if (followQuery1.error) {
      console.error("Error checking follow (iFollow):", followQuery1.error);
    } else {
      iFollow = followQuery1.data.length > 0;
    }

    // Check if userId follows ownId
    const followQuery2 = await supabase
      .from("follow")
      .select("*")
      .eq("follower", userId)
      .eq("following", ownId);

    if (followQuery2.error) {
      console.error("Error checking follow (theyFollow):", followQuery2.error);
    } else {
      theyFollow = followQuery2.data.length > 0;
    }

    // Check if userId follows ownId
    const followQuery3 = await supabase
      .from("follow")
      .select("*")
      .eq("follower", userId);

    if (followQuery3.error) {
      console.error(followQuery3.error);
    } else {
      following = followQuery3.data.length;
    }

    // Check if userId follows ownId
    const followQuery4 = await supabase
      .from("follow")
      .select("*")
      .eq("following", userId);

    if (followQuery4.error) {
      console.error(followQuery4.error);
    } else {
      follower = followQuery4.data.length;
    }
    // Add iFollow and theyFollow to the user data
    const result = { ...userData[0], iFollow, theyFollow, follower, following };

    // Return the fetched user data with follow information
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in get_user route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/toggle-follow", async (req, res) => {
  try {
    const { follower, following, username } = req.body;
    // Validate inputs
    if (!follower) {
      return res
        .status(400)
        .json({ success: false, error: "follower userId is required" });
    }
    if (!following) {
      return res
        .status(400)
        .json({ success: false, error: "following userId is required" });
    }

    // Check if the follower-following relationship already exists
    const { data: existingData, error: fetchError } = await supabase
      .from("follow")
      .select("*")
      .eq("follower", follower)
      .eq("following", following);

    if (fetchError) {
      console.error("Error checking follow relationship:", fetchError);
      return res
        .status(500)
        .json({ success: false, error: "Error checking follow relationship" });
    }

    // If the relationship exists, delete it
    if (existingData && existingData.length > 0) {
      const { error: deleteError } = await supabase
        .from("follow")
        .delete()
        .eq("follower", follower)
        .eq("following", following);

      if (deleteError) {
        console.error("Error deleting follow relationship:", deleteError);
        return res.status(500).json({
          success: false,
          error: "Error deleting follow relationship",
        });
      }

      const message = `${username} unfollowed you`;
      await supabase
        .from("notification")
        .insert([{ userId: following, message }]);

      return res.json({
        success: true,
        message: `${follower} unfollowed ${following}`,
      });
    }

    // Insert the new follower-following relationship
    const { data: insertData, error: insertError } = await supabase
      .from("follow")
      .insert([{ follower, following }]);

    if (insertError) {
      console.error("Error inserting follow relationship:", insertError);
      return res
        .status(500)
        .json({ success: false, error: "Error inserting follow relationship" });
    }

    const message = `${username} started following you`;
    await supabase
      .from("notification")
      .insert([{ userId: following, message }]);

    // Return success response
    res.json({
      success: true,
      message: `${follower} started following ${following}`,
    });
  } catch (error) {
    console.error("Error in follow_user route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
