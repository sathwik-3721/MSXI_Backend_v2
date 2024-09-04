const { extractExifData, analyzeImageContent } = require("../services/imageService");
const { extractText, analyzeText } = require("../services/pdfService");
const { getClaimDetails } = require("./pdfController");
const { Storage } = require('@google-cloud/storage');
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
        const claimID = analyzedText["Claim Number"].replace(/\s+/g, ''); // Remove spaces from claimID
        const aiStatus = analyzedText["Claim Status"];  // Assuming Claim Status is derived from analyzedText
  
        // Generate a unique ID for this upload (PDF + images)
        const uploadId = claimID;
        console.log("UploadID:", uploadId);
  
        // Step 2: Upload PDF to GCS
        const pdfFileName = `${uploadId}/pdfs/${pdfFile.originalname}`;
        const pdfFileUpload = storage.bucket(bucketName).file(pdfFileName);
        await pdfFileUpload.save(pdfFile.buffer);
        const pdfUrl = `https://storage.googleapis.com/${bucketName}/${pdfFileName}`;
  
        // Step 3: Process and upload each image to GCS
        const imageResults = [];
        let imageMetadataArray = [];
  
        for (const image of images) {
            const { formattedDate, validationMessage } = extractExifData(image.buffer, claimDate);
  
            const imageFileName = `${uploadId}/images/${image.originalname}`;
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
  
        const connection = await pool.getConnection();
        try {
            console.log("Started adding to table");
            await connection.beginTransaction();
  
            // Insert PDF URL into PDF table
            await connection.query(
                'INSERT INTO PDF_table (claimID, pdf_url) VALUES (?, ?)',
                [claimID, pdfUrl]
            );
  
            // Insert each image URL into Image table
            for (const imageUrl of imageUrlList) {
                await connection.query(
                    'INSERT INTO Image_table (claimID, image_url) VALUES (?, ?)',
                    [claimID, imageUrl]
                );
            }
  
            // Insert claim status and AI-status into Claim table
            await connection.query(
                'INSERT INTO Claim_table (claimID, status, ai_status) VALUES (?, ?, ?)',
                [claimID, null, aiStatus]
            );
  
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            console.log("finished adding into table");
            connection.release();
        }
  
        // Combine the results
        const combinedResults = {
            claimDetails: {
                claimDate,
                itemCovered,
                pdfGcsPath: pdfUrl,
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
