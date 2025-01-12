const express = require("express");
const router = express.Router();

const cart = require("./cart");
const details = require("./details");

router.use("/cart", cart);
router.use("/details", details);

router.get("/", (req, res) => {
  res.json({ message: "User API is working!" });
});

module.exports = router;
