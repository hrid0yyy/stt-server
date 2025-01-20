const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Route to get Cart API status
router.get("/", (req, res) => {
  res.json({ message: "User Messenger API is working!" });
});

function roomID(str1, str2) {
  const sortedStrings = [str1, str2].sort();
  return `${sortedStrings[0]}$${sortedStrings[1]}`;
}
function extractId(roomId, userId) {
  // Split the roomId by '$'
  const users = roomId.split("$");

  // Check if the userId exists in the roomId and return the other userId
  if (users[0] === userId) {
    return users[1]; // Return the second user
  } else if (users[1] === userId) {
    return users[0]; // Return the first user
  } else {
    throw new Error("userId does not belong to this room");
  }
}

// Route to insert message into the messenger table
router.post("/send", async (req, res) => {
  const { senderId, receiverId, message } = req.body;

  // Validate input
  if (!senderId || !receiverId || !message) {
    return res.status(400).json({
      success: false,
      error: "Missing senderId, receiverId, or message",
    });
  }

  try {
    // Create the room identifier
    const room = roomID(senderId, receiverId);

    // Insert the room and message into the messenger table
    const { error } = await supabase
      .from("messenger")
      .insert([{ room, message, senderId }]);

    if (error) {
      throw error;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error inserting message:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while sending the message",
    });
  }
});

// Route to fetch messages between sender and receiver
router.get("/fetch", async (req, res) => {
  const { senderId, receiverId } = req.query;

  // Validate input
  if (!senderId || !receiverId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing senderId or receiverId" });
  }

  try {
    // Create the room identifier
    const room = roomID(senderId, receiverId);

    // Fetch messages from the messenger table
    const { data, error } = await supabase
      .from("messenger")
      .select("*")
      .eq("room", room)
      .order("time", { ascending: false }); // Order by time if you have a `created_at` column

    if (error) {
      throw error;
    }
    const receiverInfo = await getUserById(receiverId);
    res.status(200).json({ success: true, messages: data, receiverInfo });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching messages",
    });
  }
});

// Route to delete a message by id
router.delete("/delete", async (req, res) => {
  const { id } = req.body;

  // Validate input
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: "Missing message id" });
  }

  try {
    // Delete the row with the specified id
    const { error } = await supabase.from("messenger").delete().eq("id", id);

    if (error) {
      throw error;
    }

    res
      .status(200)
      .json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while deleting the message",
    });
  }
});

router.get("/new", async (req, res) => {
  const { senderId, receiverId, id, isSeen } = req.query;

  // Validate input
  if (!senderId || !receiverId || !id) {
    return res.status(400).json({
      success: false,
      error: "Missing senderId, receiverId, or id",
    });
  }

  try {
    // Create the room identifier
    const room = roomID(senderId, receiverId);

    // Fetch messages with id greater than the provided id
    const { data, error } = await supabase
      .from("messenger")
      .select("*")
      .eq("room", room)
      .gt("id", id) // Only fetch rows where id > provided id
      .order("time", { ascending: true }); // Order by time if you have a `created_at` column

    if (error) {
      throw error;
    }
    if (isSeen != "false") {
      markMessagesAsSeen(room);
    }

    res.status(200).json({ success: true, messages: data });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching messages",
    });
  }
});

async function markMessagesAsSeen(roomId) {
  if (!roomId) {
    throw new Error("roomId is required");
  }

  try {
    // Update the status to "seen" for all messages in the given room
    const { data, error } = await supabase
      .from("messenger")
      .update({ status: "seen" })
      .eq("room", roomId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating message status:", error);
    return { success: false, error: error.message };
  }
}

async function getUserById(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  try {
    // Fetch user data from the users table
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single(); // Use .single() to fetch a single row

    if (error) {
      throw error;
    }

    return data; // Return the user data
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("An error occurred while fetching user data");
  }
}

router.get("/inbox", async (req, res) => {
  const { userId } = req.query;

  // Validate input
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "Missing userId",
    });
  }

  try {
    // Fetch all messages involving the userId
    const { data, error } = await supabase
      .from("messenger")
      .select("*")
      .like("room", `%${userId}%`) // Match rooms containing the userId
      .order("time", { ascending: false }); // Order messages by time descending

    if (error) {
      throw error;
    }

    // Filter to get the last message per room
    const lastMessages = Object.values(
      data.reduce((acc, message) => {
        if (!acc[message.room]) {
          acc[message.room] = message;
        }
        return acc;
      }, {})
    );

    // Add the other userId to each message
    const messagesWithOtherUser = await Promise.all(
      lastMessages.map(async (message) => {
        const receiverId = extractId(message.room, userId);
        const receiverInfo = await getUserById(receiverId); // Wait for the user data
        return {
          ...message,
          receiverInfo, // Add the receiverInfo to the message
        };
      })
    );

    res.status(200).json({ success: true, messages: messagesWithOtherUser });
  } catch (error) {
    console.error("Error fetching last messages:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred while fetching messages",
    });
  }
});

module.exports = router;
