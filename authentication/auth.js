const express = require("express");
const bcrypt = require("bcrypt");
const supabase = require("../config/supabase");
const router = express.Router();

// Authentication Route
router.get("/auth", (req, res) => {
  res.json({ message: "Authentication API is working!" });
});

router.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Email and password are required!" });
  }

  try {
    // Sign up the user in Supabase Authentication
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Extract the user ID from the response
    const userId = data.user?.id;

    if (!userId) {
      return res
        .status(500)
        .json({ success: false, error: "User ID not found after signup." });
    }

    // Insert only the user ID into the "users" table
    const { error: insertError } = await supabase
      .from("users")
      .insert([{ id: userId }]);

    if (insertError) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to insert user ID." });
    }

    res.status(201).json({
      success: true,
      message: "Signup successful",
      token: data.session?.access_token,
    });
  } catch (err) {
    res.status(500).json({ success: false, details: err.message });
  }
});

router.post("/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required!" });
    }

    // Supabase built-in authentication sign-in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      token: data.session.access_token,
    });
  } catch (err) {
    res.status(500).json({ success: false, details: err.message });
  }
});

router.post("/auth/signout", async (req, res) => {
  try {
    // Extract token from request body
    const { token } = req.body;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }

    // Revoke the session (disable token)
    const { error } = await supabase.auth.signOut({ token });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: "User signed out successfully. Token is now revoked.",
    });
  } catch (err) {
    res.status(500).json({ success: false, details: err.message });
  }
});

router.get("/auth/user", async (req, res) => {
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

    res.json({ success: true, userId: data.user.id });
  } catch (err) {
    res.status(500).json({ success: false, details: err.message });
  }
});

// Login Route For Owner
router.post("/auth/owner/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Email and password are required!" });
  }

  // Fetch user from Supabase
  const { data, error } = await supabase
    .from("shopowner")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid email or password" });
  }

  // Compare hashed password
  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid email or password" });
  }

  res.json({ success: true, message: "Login successful!", user: data });
});

// Register New Account For Owner
router.post("/auth/owner/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "All fields are required!" });
  }

  try {
    // Check if email already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("shopowner")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, error: "Email already exists!" });
    }

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means no matching row found, which is expected if new user
      throw fetchError;
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into Supabase
    const { data, error } = await supabase
      .from("shopowner")
      .insert([{ email, password: hashedPassword }])
      .select("*"); // Returns the inserted user

    if (error) {
      console.error("Supabase Insert Error:", error);
      return res
        .status(500)
        .json({ success: false, error: "User registration failed" });
    }

    res.json({
      success: true,
      message: "User registered successfully!",
      user: data[0],
    });
  } catch (err) {
    console.error("Unexpected Error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
