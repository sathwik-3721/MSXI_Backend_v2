const express = require("express");
const { extractPdf } = require("../controllers/pdfController");
const upload = require('../moddleware/upload')

const router = express.Router();

router.post("/extract-pdf", upload.single("pdf"), extractPdf);

module.exports = router;
