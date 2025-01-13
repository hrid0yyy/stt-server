const express = require("express");
const router = express.Router();

const cart = require("./cart");
const details = require("./details");
const payment = require("./payment");
const book = require("./book");

router.use("/cart", cart);
router.use("/details", details);
router.use("/payment", payment);
router.use("/book", book);

router.get("/", (req, res) => {
  res.json({ message: "User API is working!" });
});

module.exports = router;
