const express = require("express");
const { verifyMetadata, analyzeImage, processClaimDocuments } = require("../controllers/imageController");
const upload = require("../moddleware/upload");

const router = express.Router();

router.post("/verify-metadata", upload.array("images", 10), verifyMetadata);
router.get("/analyze-image", analyzeImage);
router.post('/process-claim-documents', upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]), processClaimDocuments);

module.exports = router;
