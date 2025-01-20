const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const supabase = require("../config/supabase"); // Your Supabase client configuration
const Tessaract = require("tesseract.js");
const nlp = require("compromise");

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

// Route for extracting text from an image
router.post("/search", upload.single("image"), async (req, res) => {
  try {
    // Check if a file is uploaded

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    // Resolve the file path to the absolute path
    const filePath = path.resolve(__dirname, "..", req.file.path); // Assuming the file is inside the "uploads/" folder

    // Ensure the file exists before attempting text extraction
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      return res.status(400).json({ success: false, error: "File not found" });
    }

    // Extract text using Tesseract
    const { data } = await Tessaract.recognize(filePath, "eng");

    // Delete the temporary file after processing
    await fs.unlink(filePath);

    const searchItems = extractWords(data.text);

    if (searchItems.length === 0) {
      return res.status(200).json({ success: false, books: [] });
    }

    try {
      let query = supabase.from("books").select("*");

      // Check if searchItems is provided and is an array
      if (Array.isArray(searchItems) && searchItems.length > 0) {
        // Construct the OR condition for each item in the array
        const searchConditions = searchItems
          .map(
            (item) =>
              `title.ilike.%${item}%,genres.ilike.%${item}%,characters.ilike.%${item}%,attributes.ilike.%${item}%,author.ilike.%${item}%`
          )
          .join(",");

        // Apply search filter using the OR condition
        query = query.or(searchConditions);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Only send the response once here
      return res.status(200).json({ success: true, books: data });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error) {
    console.error("Error during text extraction:", error.message);

    // Delete the temporary file in case of an error
    if (req.file && req.file.path) {
      await fs
        .unlink(req.file.path)
        .catch((err) => console.error("Error deleting file:", err.message));
    }

    return res
      .status(500)
      .json({ success: false, error: "Text extraction failed" });
  }
});

function extractWords(text) {
  return text
    .replace(/\n+/g, " ")
    .replace(/~~/g, "")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((word) => word.length >= 4);
}

module.exports = router;
