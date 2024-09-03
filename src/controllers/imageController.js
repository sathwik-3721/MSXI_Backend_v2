const { extractExifData, analyzeImageContent } = require("../services/imageService");
const { extractText, analyzeText } = require("../services/pdfService");
const { getClaimDetails } = require("./pdfController");
const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

let imageMetadataArray = [];

const bucketName = process.env.BUCKET_NAME;

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: path.join(__dirname, '../../service_account.json'),
});

const verifyMetadata = async (req, res) => {
  const { claimDate } = getClaimDetails();
  console.log("Claim Date:", claimDate);

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send("No files uploaded.");
    }

    const results = [];

    // Clear the array to avoid duplication on subsequent requests
    imageMetadataArray = [];

    req.files.forEach((file) => {
      const { formattedDate, validationMessage } = extractExifData(file.buffer, claimDate);

      const imageMetadata = {
        imageName: file.originalname,
        uniqueId: Date.now().toString(),
        imageBuffer: file.buffer,
        imageDate: formattedDate,
        validationMessage: validationMessage,
      };

      imageMetadataArray.push(imageMetadata);

      results.push({
        fileName: file.originalname,
        message: validationMessage,
        claimDate,
        imageDate: formattedDate,
      });
    });

    return res.status(200).json({ results });
  } catch (error) {
    console.error("Error processing images:", error.message);
    return res.status(500).send({
      message: "An error occurred while processing the images.",
      claimDate,
      imageDate: "Invalid Image",
    });
  }
};

const analyzeImage = async (req, res) => {
  try {
    if (imageMetadataArray.length === 0) {
      return res.status(400).send("No image metadata available. Please verify images first.");
    }

    const { itemCovered } = getClaimDetails();
    console.log("Item Covered:", itemCovered);
    const results = [];

    console.log("metadata array", imageMetadataArray);

    for (const imageMetadata of imageMetadataArray) {
      const result = await analyzeImageContent(imageMetadata.imageBuffer, itemCovered);
      console.log("result", result);
      results.push({
        fileName: imageMetadata.imageName,
        ...result,
      });
    }

    // Optionally clear the array after processing
    // imageMetadataArray = [];

    return res.json({ results });
  } catch (error) {
    console.error("Error processing images:", error.message);
    return res.status(500).send("Error processing images.");
  }
};

const processClaimDocuments = async (req, res) => {
    try {
        console.log("bucket name", bucketName);
      // Accessing the PDF file and images
      const pdfFile = req.files['pdfFile'] ? req.files['pdfFile'][0] : null;
      const images = req.files['images'];
  
      if (!pdfFile || !images || images.length === 0) {
        return res.status(400).send("Please upload both PDF and images.");
      }
  
      // Step 1: Extract text and claim details from the PDF
      const extractedText = await extractText(pdfFile.buffer);
      console.log("ExtractedText: ", extractedText);
      const analyzedText = await analyzeText(extractedText);
      console.log("analyzedText", analyzedText);
      const claimDate = analyzedText["Claim Date"];
      const itemCovered = analyzedText["Items Covered"];
  
      // Generate a unique ID for this upload (PDF + images)
      const uploadId = Date.now().toString();
  
      // Step 2: Upload PDF to GCS
      const pdfFileName = `${uploadId}/pdfs/${pdfFile.originalname}`;
      const pdfFileUpload = storage.bucket(bucketName).file(pdfFileName);
      await pdfFileUpload.save(pdfFile.buffer);
  
      // Step 3: Process and upload each image to GCS
      const imageResults = [];
      let imageMetadataArray = [];
  
      for (const image of images) {
        const { formattedDate, validationMessage } = extractExifData(image.buffer, claimDate);
  
        const imageFileName = `${uploadId}/images/${image.originalname}`;
        const imageFileUpload = storage.bucket(bucketName).file(imageFileName);
        await imageFileUpload.save(image.buffer);
  
        const imageMetadata = {
          imageName: image.originalname,
          uniqueId: Date.now().toString(),
          imageBuffer: image.buffer,
          imageDate: formattedDate,
          validationMessage: validationMessage,
          gcsPath: `gs://${bucketName}/${imageFileName}`,
        };
  
        imageMetadataArray.push(imageMetadata);
  
        imageResults.push({
          fileName: image.originalname,
          message: validationMessage,
          claimDate,
          imageDate: formattedDate,
        });
      }
  
      // Step 4: Analyze image content using the claim details from the PDF
      const analysisResults = [];
      for (const imageMetadata of imageMetadataArray) {
        const analysisResult = await analyzeImageContent(imageMetadata.imageBuffer, itemCovered);
        analysisResults.push({
          imageName: imageMetadata.imageName,
          analysisResult,
          gcsPath: imageMetadata.gcsPath,
        });
      }
  
      // Combine the results
      const combinedResults = {
        claimDetails: {
          claimDate,
          itemCovered,
          pdfGcsPath: `gs://${bucketName}/${pdfFileName}`,
        },
        imageResults,
        analysisResults,
      };
  
      return res.status(200).json(combinedResults);
    } catch (error) {
      console.error("Error processing claim documents:", error.message);
      return res.status(500).send({
        message: "An error occurred while processing the claim documents.",
      });
    }
  };

module.exports = { analyzeImage, verifyMetadata, processClaimDocuments };