const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "User ebook API is working!" });
});

router.post("/fetch", async (req, res) => {
  try {
    const { search, sort } = req.body;

    // Call fetchEbooks with the searchTerm and sortOrder from query parameters
    const ebooks = await fetchEbooks(search, sort);

    if (ebooks === false) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch ebooks" });
    }

    // Return the result
    res.json({ success: true, ebooks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

const fetchEbooks = async (searchTerm = "", sortOrder = "asc") => {
  try {
    // Fetch all books with the required fields from the books table
    const { data: books, error: bookError } = await supabase
      .from("books")
      .select(
        "bookId, title,cover, description, author, page, genres, characters, attributes"
      );
    if (bookError) throw bookError;

    // Get all bookIds from the books table
    const bookIds = books.map((book) => book.bookId);

    // Fetch only the ebooks that have a matching bookId in the books table
    const { data: ebooks, error: ebookError } = await supabase
      .from("eBooks")
      .select("bookId, price, url")
      .in("bookId", bookIds); // Filter ebooks based on bookId
    if (ebookError) throw ebookError;

    // Create a map of ebooks by bookId for easy lookup
    const ebookMap = ebooks.reduce((acc, ebook) => {
      acc[ebook.bookId] = ebook;
      return acc;
    }, {});

    // Combine books and their corresponding ebooks based on bookId
    const allBooks = books.map((book) => {
      const ebook = ebookMap[book.bookId];
      return {
        ...book,
        price: ebook ? ebook.price : null,
        url: ebook ? ebook.url : null,
      };
    });
    const filteredByUrlBooks = allBooks.filter((book) => book.url !== null);

    // Helper function to search for the term in relevant fields
    const searchBook = (book, term) => {
      const lowerCaseTerm = term.toLowerCase();
      // Check all fields except 'price' and 'url'
      return (
        book.title.toLowerCase().includes(lowerCaseTerm) ||
        book.description.toLowerCase().includes(lowerCaseTerm) ||
        (book.author && book.author.toLowerCase().includes(lowerCaseTerm)) ||
        (book.genres && book.genres.toLowerCase().includes(lowerCaseTerm)) ||
        (book.characters &&
          book.characters.toLowerCase().includes(lowerCaseTerm)) ||
        (book.attributes &&
          book.attributes.toLowerCase().includes(lowerCaseTerm))
      );
    };

    // Filter books based on the search term
    const filteredBooks = filteredByUrlBooks.filter((book) =>
      searchBook(book, searchTerm)
    );

    // Sort books by price in the specified order (ascending or descending)
    const sortedBooks = filteredBooks.sort((a, b) => {
      // If price is null, treat it as Infinity to sort it at the end
      const priceA = a.price === null ? Infinity : a.price;
      const priceB = b.price === null ? Infinity : b.price;

      if (sortOrder === "asc") {
        return priceA - priceB;
      } else if (sortOrder === "desc") {
        return priceB - priceA;
      }
      return 0; // Default case if sortOrder is not recognized
    });

    return sortedBooks;
  } catch (error) {
    return false;
  }
};

// after payment use it in payment.js
const getAccess = async (userId, bookId) => {
  try {
    // Insert into the 'eb_access' table with userId and bookId
    const { data, error } = await supabase
      .from("eb_access")
      .insert([{ userId, bookId }]);

    if (error) {
      console.error("Error inserting into eb_access:", error);
      return false; // Or you can throw an error to be handled by the calling function
    }

    return true; // Return the inserted data if successful
  } catch (error) {
    console.error("Error in insertEbAccess function:", error);
    return false; // Return false if there’s an unexpected error
  }
};

router.post("/redeem", async (req, res) => {
  const { userId, bookId } = req.body;

  if (!userId || !bookId) {
    return res.status(400).json({
      success: false,
      message: "userId and bookId are required.",
    });
  }

  try {
    const accessGranted = await getAccess(userId, bookId);

    if (accessGranted) {
      return res.status(200).json({
        success: true,
        message: "Access granted successfully.",
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to grant access.",
      });
    }
  } catch (error) {
    console.error("Error in /grant-access route:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/get_ebooks", async (req, res) => {
  try {
    const { userId, search } = req.query;

    // Ensure userId is provided
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Query the eb_access table for the given userId
    const { data, error } = await supabase
      .from("eb_access")
      .select(
        "*,books(bookId,page,title,author,description,genres,cover,language,characters,attributes),eBooks(url)"
      )
      .eq("userId", userId); // Filter rows based on userId

    if (error) {
      return res.status(500).json({ error: "Error fetching ebooks access" });
    }

    // Return the fetched data
    const response = applySearchFilter(data, search);
    if (response.length != 0) {
      return res.status(500).json({
        success: true,
        data: response,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Nothing Found",
      });
    }
  } catch (error) {
    console.error("Error in get_ebooks route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/update", async (req, res) => {
  try {
    const { userId, bookId, pageAt } = req.body;

    // Validate the input parameters
    if (!userId || !bookId || !pageAt) {
      return res.status(400).json({
        success: false,
        error: "userId, bookId, and pageAt are required",
      });
    }

    // Update the pageAt value for the given userId and bookId
    const { data, error } = await supabase
      .from("eb_access")
      .upsert([{ userId, bookId, pageAt }], {
        onConflict: ["userId", "bookId"],
      });

    // If there's an error, return the error message
    if (error) {
      console.error("Error updating pageAt:", error);
      return res
        .status(500)
        .json({ success: false, error: "Error updating pageAt" });
    }

    // Return the updated data
    res.json({ success: true });
  } catch (error) {
    console.error("Error in update_page route:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

const applySearchFilter = (books, search) => {
  // If there's no search term, return the books as is
  if (!search) {
    return books;
  }

  // Convert search term to lowercase for case-insensitive comparison
  const lowerCaseSearch = search.toLowerCase();

  return books.filter((book) => {
    // Check if any field contains the search term (case-insensitive)
    const fieldsToCheck = [
      "title",
      "description",
      "genres",
      "language",
      "characters",
      "attributes",
    ];

    return fieldsToCheck.some((field) => {
      // Check if the field exists and contains the search term
      if (book.books && book.books[field]) {
        return book.books[field].toLowerCase().includes(lowerCaseSearch);
      }
      return false;
    });
  });
};

module.exports = router;
