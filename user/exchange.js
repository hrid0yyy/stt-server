const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "exchange book API is working!" });
});

router.post("/add", async (req, res) => {
  try {
    const { userId, title, location, description, prefItem, image } = req.body;

    // Validate required fields
    if (!userId || !title || !location || !description || !prefItem || !image) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // Insert data into the Supabase database
    const { data, error } = await supabase
      .from("exchange_books") // Table name in Supabase
      .insert([
        {
          userId,
          title,
          location,
          description,
          prefItem,
          image,
        },
      ])
      .select("*"); // Ensure the inserted row is returned

    if (error) {
      console.error("Error inserting into database:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Respond with success
    res.status(201).json({
      success: true,
    });
  } catch (error) {
    console.error("Error inserting exchange book:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to insert exchange book" });
  }
});

router.post("/fetch", async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    // Query data from the Supabase database
    const { data, error } = await supabase
      .from("exchange_books") // Table name in Supabase
      .select("*") // Select all columns
      .eq("userId", userId)
      .eq("available", 1); // Filter by userId

    if (error) {
      console.error("Error fetching from database:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Respond with success and data

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching exchange books:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch exchange books" });
  }
});

router.post("/search", async (req, res) => {
  try {
    const { userId, search } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    let query = supabase
      .from("exchange_books")
      .select("*,users(full_name,profile_url,username)")
      .not("userId", "eq", userId)
      .eq("available", 1);

    // Add search filter if search is provided
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,prefItem.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching from database:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Respond with success and data
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching search results:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch search results" });
  }
});

router.post("/filter", async (req, res) => {
  try {
    const { userId, search } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    let query = supabase
      .from("exchange_books")
      .select("title, exchangeId")
      .eq("userId", userId)
      .eq("available", 1);

    // Add search filter if search is provided
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,prefItem.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching from database:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Respond with success and data
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching search results:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch search results" });
  }
});

router.get("/details", async (req, res) => {
  try {
    const { exchangeId } = req.query; // Use query parameters instead of the body

    // Validate required fields
    if (!exchangeId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing exchangeId" });
    }

    // Query data from the Supabase database
    const { data, error } = await supabase
      .from("exchange_books") // Table name in Supabase
      .select("*,users(full_name,username,email,profile_url)") // Select all columns
      .eq("exchangeId", exchangeId); // Filter by exchangeId

    if (error) {
      console.error("Error fetching details from database:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Check if data exists
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Exchange book not found" });
    }

    // Respond with success and data
    res.status(200).json({
      success: true,
      data: data[0], // Return the single matching record
    });
  } catch (error) {
    console.error("Error fetching exchange book details:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch exchange book details" });
  }
});

// integration remaining
router.post("/send", async (req, res) => {
  try {
    const { sender_eid, receiver_eid } = req.query;

    if (!sender_eid || !receiver_eid) {
      return res
        .status(400)
        .json({ success: false, error: "Missing parameters" });
    }

    // Check if a row with the same sender_eid and receiver_eid already exists
    const { data: existingData, error: checkError } = await supabase
      .from("exchange_req")
      .select("*")
      .eq("sender_eid", sender_eid)
      .eq("receiver_eid", receiver_eid);

    if (checkError) {
      console.error("Error checking existing row:", checkError);
      return res
        .status(500)
        .json({ success: false, error: checkError.message });
    }

    if (existingData && existingData.length > 0) {
      return res
        .status(200)
        .json({ success: false, message: "Request Pending" });
    }

    // Insert data into the Supabase database
    const { data, error } = await supabase
      .from("exchange_req")
      .insert([{ sender_eid, receiver_eid }])
      .select("*");

    if (error) {
      console.error("Error inserting into database:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(201).json({
      success: true,
    });
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(500).json({ success: false, error: "Failed to send request" });
  }
});
// integration remaining
router.post("/response", async (req, res) => {
  try {
    const { sender_eid, receiver_eid, response } = req.body;

    if (!sender_eid || !receiver_eid || !response) {
      return res
        .status(400)
        .json({ success: false, error: "Missing parameters" });
    }

    // Update the response column and set response_time to now()
    const { data } = await supabase
      .from("exchange_req")
      .update({
        response,
        response_time: new Date().toISOString(), // Set response_time to the current timestamp
      })
      .eq("sender_eid", sender_eid)
      .eq("receiver_eid", receiver_eid)
      .select("*");

    if (response === "Accepted") {
      try {
        // Update sender's exchange book and log the response
        const { data: senderData, error: senderError } = await supabase
          .from("exchange_books")
          .update({
            available: 0,
          })
          .eq("exchangeId", sender_eid)
          .select("*");

        if (senderError) {
          throw new Error(senderError.message); // Throw error if the query fails
        }

        console.log("Sender ID : ", senderData[0]?.userId); // Ensure data exists

        // Insert notification for the sender
        const senderNotification = await supabase.from("notification").insert([
          {
            userId: senderData[0]?.userId, // Assuming senderData[0]?.userId is valid
            message: `Your exchange request for ${senderData[0]?.title} has been accepted.`,
          },
        ]);

        if (senderNotification.error) {
          throw new Error(senderNotification.error.message); // Throw error if notification insertion fails
        }

        console.log("Notification for sender inserted successfully");

        // Update receiver's exchange book and log the response
        const { data: receiverData, error: receiverError } = await supabase
          .from("exchange_books")
          .update({
            available: 0,
          })
          .eq("exchangeId", receiver_eid)
          .select("*");

        if (receiverError) {
          throw new Error(receiverError.message); // Throw error if the query fails
        }

        console.log("Receiver ID : ", receiverData[0]?.userId); // Ensure data exists

        // Insert notification for the receiver
        const receiverNotification = await supabase
          .from("notification")
          .insert([
            {
              userId: receiverData[0]?.userId, // Assuming receiverData[0]?.userId is valid
              message: `You have accepted the exchange request for ${receiverData[0]?.title}.`,
            },
          ]);

        if (receiverNotification.error) {
          throw new Error(receiverNotification.error.message); // Throw error if notification insertion fails
        }

        console.log("Notification for receiver inserted successfully");
      } catch (error) {
        // Catch any error thrown from Supabase queries or elsewhere in the try block
        console.error("Error processing request:", error.message);

        // Send a failure response
        res.status(500).json({
          success: false,
          error: "Failed to update exchange books or insert notification",
        });
        return; // Ensure you stop execution after error response
      }
    } else {
      try {
        // Update sender's exchange book and log the response
        const { data: senderData, error: senderError } = await supabase
          .from("exchange_books")
          .update({
            available: 1,
          })
          .eq("exchangeId", sender_eid)
          .select("*");

        if (senderError) {
          throw new Error(senderError.message); // Throw error if the query fails
        }

        console.log("Sender ID : ", senderData[0]?.userId); // Ensure data exists

        // Insert notification for the sender
        const senderNotification = await supabase.from("notification").insert([
          {
            userId: senderData[0]?.userId, // Assuming senderData[0]?.userId is valid
            message: `Your exchange request for ${senderData[0]?.title} has been declined.`,
          },
        ]);

        if (senderNotification.error) {
          throw new Error(senderNotification.error.message); // Throw error if notification insertion fails
        }

        console.log("Notification for sender inserted successfully");
      } catch (error) {
        // Catch any error thrown from Supabase queries or elsewhere in the try block
        console.error("Error processing request:", error.message);

        // Send a failure response
        res.status(500).json({
          success: false,
          error: "Failed to update exchange books or insert notification",
        });
        return; // Ensure you stop execution after error response
      }
    }

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching request found to update",
      });
    }

    res.status(200).json({
      success: true,
      message: "Response updated successfully",
    });
  } catch (error) {
    console.error("Error processing request:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to update response" });
  }
});
// integration remaining
router.get("/requests", async (req, res) => {
  try {
    // Extract receiver_id from query parameters or request body
    const { p_receiver_id } = req.query; // Assuming the receiver_id is passed as a query parameter

    if (!p_receiver_id) {
      return res.status(400).json({ error: "receiver_id is required" });
    }

    // Call the RPC function using the Supabase client
    const { data, error } = await supabase.rpc("get_exchange_requests", {
      p_receiver_id,
    });

    // Handle any errors from the RPC call
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Return the data to the client
    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching exchange requests:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
