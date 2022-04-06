const express = require('express');
const router = express.Router();
const UrlController = require("../controller/urlController");


router.post("/url/shorten", UrlController.shortenUrl);

router.get("/:urlCode" , UrlController.redirect);



module.exports = router;