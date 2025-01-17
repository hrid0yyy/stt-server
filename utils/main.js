const express = require("express");
const router = express.Router();

const image = require("./image");

router.use("/image", image);

router.get("/", (req, res) => {
  res.json({ message: "utils API is working!" });
});

module.exports = router;
