const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const supabase = require("../config/supabase"); // Your Supabase client configuration

const router = express.Router();

// Set up Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Supabase bucket name
const BUCKET_NAME = "stt-storage";

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    // Check if a file is uploaded
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    // Read the uploaded file
    const filePath = path.resolve(req.file.path);
    const fileBuffer = await fs.readFile(filePath);

    // Generate a unique file name
    const uniqueFileName = `${Date.now()}_${req.file.originalname}`;

    // Upload the file to the Supabase bucket
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`images/${uniqueFileName}`, fileBuffer, {
        contentType: req.file.mimetype, // Use the MIME type from the uploaded file
      });

    // Delete the temporary file from the server
    await fs.unlink(filePath);

    if (error) {
      console.error("Error uploading file to Supabase:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Generate the public URL of the uploaded file
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/images/${uniqueFileName}`;

    // Respond with the public URL and success message
    res.status(200).json({
      success: true,
      publicUrl,
    });
  } catch (error) {
    console.error("Error during file upload:", error.message);
    res.status(500).json({ success: false, error: "File upload failed" });
  }
});

module.exports = router;
