const express = require("express");
const { processClaimDocuments } = require("../controllers/imageController");
const upload = require("../middleware/upload");

const router = express.Router();

router.post('/process-claim-documents', upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]), processClaimDocuments);

module.exports = router;
