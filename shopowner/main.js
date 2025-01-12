const express = require("express");
const router = express.Router();

const book = require("./book");
const discount = require("./discount");

router.use("/book", book);
router.use("/discount", discount);

router.get("/", (req, res) => {
  res.json({ message: "SO API is working!" });
});

module.exports = router;
