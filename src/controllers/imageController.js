const { extractExifData, analyzeImageContent } = require("../services/imageService");
const { extractText, analyzeText } = require("../services/pdfService");
const { getClaimDetails } = require("./pdfController");
const { Storage } = require('@google-cloud/storage');
const { processTransaction } = require('../util/dbQueries'); // Adjust the path accordingly
const path = require('path');
const pool = require('../config/db');  // Importing the database connection
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
        // Accessing the PDF file and images
        const pdfFile = req.files['pdfFile'] ? req.files['pdfFile'][0] : null;
        const images = req.files['images'];

        if (!pdfFile || !images || images.length === 0) {
            return res.status(400).send("Please upload both PDF and images.");
        }

        // Return "OK submitted" response immediately
        res.status(200).send({ message: "OK submitted" });

        // Run the processing in the background
        setImmediate(async () => {
            try {
                // Step 1: Extract text and claim details from the PDF
                const extractedText = await extractText(pdfFile.buffer);
                const analyzedText = await analyzeText(extractedText);

                const claimID = analyzedText["Claim Number"].replace(/\s+/g, '');
                const claimDate = analyzedText["Claim Date"];
                const itemCovered = analyzedText["Items Covered"];
                const aiStatus = analyzedText["Claim Status"];

                // Step 2: Upload PDF to GCS
                const pdfFileName = `${claimID}/pdfs/${pdfFile.originalname}`;
                const pdfFileUpload = storage.bucket(bucketName).file(pdfFileName);
                await pdfFileUpload.save(pdfFile.buffer);
                const pdfUrl = `https://storage.googleapis.com/${bucketName}/${pdfFileName}`;

                // Step 3: Process and upload each image to GCS
                const imageResults = [];
                let imageMetadataArray = [];

                for (const image of images) {
                    const { formattedDate, validationMessage } = extractExifData(image.buffer, claimDate);

                    const imageFileName = `${claimID}/images/${image.originalname}`;
                    const imageFileUpload = storage.bucket(bucketName).file(imageFileName);
                    await imageFileUpload.save(image.buffer);
                    const imageUrl = `https://storage.googleapis.com/${bucketName}/${imageFileName}`;

                    const imageMetadata = {
                        imageName: image.originalname,
                        uniqueId: Date.now().toString(),
                        imageBuffer: image.buffer,
                        imageDate: formattedDate,
                        validationMessage: validationMessage,
                        gcsPath: imageUrl,
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

                // Step 5: Store URLs and statuses in the database
                const imageUrlList = imageMetadataArray.map(image => image.gcsPath);

                // Call the utility function for database transactions
                await processTransaction(claimID, pdfUrl, imageUrlList, aiStatus);

                // Combined results (you can store this in logs or a database if needed)
                const combinedResults = {
                    claimDetails: {
                        claimDate,
                        itemCovered,
                        pdfGcsPath: pdfUrl,
                    },
                    imageResults,
                    analysisResults,
                };

                console.log("Processing completed for Claim ID:", claimID);

            } catch (error) {
                console.error("Error processing claim documents in background:", error.message);
            }
        });

    } catch (error) {
        console.error("Error handling upload request:", error.message);
        return res.status(500).send({
            message: "An error occurred while handling the upload request.",
        });
    }
};

module.exports = { analyzeImage, verifyMetadata, processClaimDocuments };
