const express = require("express");
const router = express.Router();

const cart = require("./cart");
const details = require("./details");
const payment = require("./payment");
const book = require("./book");
const exchange = require("./exchange");
const notification = require("./notification");
const ebooks = require("./ebooks");
const messenger = require("./messenger");
const post = require("./post");
const profile = require("./profile");
const home = require("./home");

router.use("/cart", cart);
router.use("/details", details);
router.use("/payment", payment);
router.use("/book", book);
router.use("/exchange", exchange);
router.use("/notification", notification);
router.use("/ebooks", ebooks);
router.use("/messenger", messenger);
router.use("/post", post);
router.use("/profile", profile);
router.use("/home", home);

router.get("/", (req, res) => {
  res.json({ message: "User API is working!" });
});

module.exports = router;
