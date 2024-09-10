const { extractExifData, analyzeImageContent, aiSuggestion } = require("../services/imageService");
const { extractText, analyzeText } = require("../services/pdfService");
const { Storage } = require('@google-cloud/storage');
const { processTransaction } = require('../util/dbQueries'); // Adjust the path accordingly
const path = require('path');
require('dotenv').config();

const bucketName = process.env.BUCKET_NAME;

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: path.join(__dirname, '../../service_account.json'),
});

const processClaimDocuments = async (req, res) => {
    try {
        // Accessing the PDF file and images
        const pdfFile = req.files['pdfFile'] ? req.files['pdfFile'][0] : null;
        const images = req.files['images'];

        if (!pdfFile || !images || images.length === 0) {
            return res.status(400).send("Please upload both PDF and images.");
        }

        // Return "OK submitted" response after 5 seconds
        setTimeout(() => {
            res.status(200).send({ message: "Files have been sucessfully uploaded and being processed in background" });
        }, 5000);
        
        // Run the processing in the background
        setImmediate(async () => {
            try {
                // Step 1: Extract text and claim details from the PDF
                const extractedText = await extractText(pdfFile.buffer);
                const analyzedText = await analyzeText(extractedText);

                const claimID = analyzedText["Claim Number"].replace(/\s+/g, '');
                const claimDate = analyzedText["Claim Date"];
                const itemCovered = analyzedText["Items Covered"];
                const pdfStatus = analyzedText["Claim Status"];

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
                    const analysisResult = await analyzeImageContent(imageMetadata.imageBuffer, itemCovered, imageMetadataArray);
                    analysisResults.push({
                        imageName: imageMetadata.imageName,
                        analysisResult,
                        gcsPath: imageMetadata.gcsPath,
                    });
                }

                // Step 5: Store URLs and statuses in the database
                const imageUrlList = imageMetadataArray.map(image => image.gcsPath);

                // Call the utility function for database transactions
                await processTransaction(claimID, pdfUrl, imageUrlList, null, analyzedText, analysisResults);

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

                const aiSuggestionResult = await aiSuggestion(claimID);
                console.log("Ai suggestion", aiSuggestionResult);

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

module.exports = { processClaimDocuments };
