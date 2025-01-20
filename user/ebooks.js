const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "User ebook API is working!" });
});

router.get("/fetch", async (req, res) => {
  try {
    const { search, sort } = req.query;

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

    return data; // Return the inserted data if successful
  } catch (error) {
    console.error("Error in insertEbAccess function:", error);
    return false; // Return false if there’s an unexpected error
  }
};

router.get("/get_ebooks", async (req, res) => {
  try {
    const { userId } = req.query;

    // Ensure userId is provided
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Query the eb_access table for the given userId
    const { data, error } = await supabase
      .from("eb_access")
      .select("*,books(page,title,author,description,genres,cover,language)")
      .eq("userId", userId); // Filter rows based on userId

    if (error) {
      return res.status(500).json({ error: "Error fetching ebooks access" });
    }

    // Return the fetched data
    res.json(data);
  } catch (error) {
    console.error("Error in get_ebooks route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
