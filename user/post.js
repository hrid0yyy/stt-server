const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "user post API is working!" });
});

router.post("/create", async (req, res) => {
  try {
    const { userId, content } = req.body;

    // Validate inputs
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "userId is required" });
    }
    if (!content) {
      return res
        .status(400)
        .json({ success: false, error: "content is required" });
    }

    // Insert the new post into the posts table
    const { data, error } = await supabase
      .from("posts")
      .insert([{ userId, content }]); // Insert userId and content into the posts table

    // Handle errors during insertion
    if (error) {
      console.error("Error creating post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Error creating post" });
    }

    // Return success response
    res.json({ success: true });
  } catch (error) {
    console.error("Error in create_post route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.delete("/post", async (req, res) => {
  try {
    const { id } = req.query;

    // Validate input
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Post ID is required" });
    }

    // Delete the post with the given ID
    const { data, error } = await supabase.from("posts").delete().eq("id", id); // Delete where the post ID matches

    // If there was an error during the deletion
    if (error) {
      console.error("Error deleting post:", error);
      return res.status(500).json({ error: "Error deleting post" });
    }

    // If no data was deleted, it means the post ID wasn't found
    if (data.length === 0) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // Return success message
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error in delete post route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.get("/fetch-own", async (req, res) => {
  try {
    const { userId } = req.query;

    // Validate inputs
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "userId is required" });
    }

    // Insert the new post into the posts table

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("userId", userId); // Assuming 'id' is the primary key in the users table

    // Handle errors during insertion
    if (error) {
      console.error("Error fetching post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Error fetching post" });
    }

    // Return success response
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in create_post route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.get("/all", async (req, res) => {
  try {
    // Query the posts table to fetch posts in descending order of creation time
    const { data, error } = await supabase
      .from("posts")
      .select("*,users(*)")
      .order("created_at", { ascending: false }); // Order by createdAt descending

    // Handle errors during the query
    if (error) {
      console.error("Error fetching posts:", error);
      return res.status(500).json({ error: "Error fetching posts" });
    }

    // Return the fetched posts
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in get_posts route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/following", async (req, res) => {
  try {
    const { follower } = req.query;

    // Validate input
    if (!follower) {
      return res.status(400).json({ error: "follower userId is required" });
    }

    // Fetch the list of userIds that the follower is following
    const { data: followingData, error: followError } = await supabase
      .from("follow")
      .select("following")
      .eq("follower", follower); // Get the users the follower is following

    if (followError) {
      console.error("Error fetching following data:", followError);
      return res
        .status(500)
        .json({ success: false, error: "Error fetching following data" });
    }

    if (!followingData || followingData.length === 0) {
      return res.status(404).json({ success: true, data: [] });
    }

    // Get the IDs of the users being followed
    const followingIds = followingData.map((item) => item.following);

    // Fetch user details and posts for those followed users
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select(
        `
          id,
          username,
          profile_url,
          posts(*)
        `
      )
      .in("id", followingIds); // Get users and their posts where the userId is in the list of followed users

    if (usersError) {
      console.error("Error fetching user data:", usersError);
      return res
        .status(500)
        .json({ success: false, error: "Error fetching user data" });
    }

    // Flatten the posts and include user details, and sort by post created_at
    const posts = usersData
      .flatMap((user) =>
        user.posts.map((post) => ({
          ...post,
          userId: user.id,
          username: user.username,
          profile_url: user.profile_url,
        }))
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Return the sorted posts
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error("Error in following route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
