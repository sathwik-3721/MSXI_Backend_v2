require('dotenv').config();
const sql = require('mssql');
const poolPromise = require('../config/db'); // Import the database connection

// Function to insert PDF URL into PDF table
const insertPdf = async (claimID, pdfUrl, pdfDescription) => {
    try {
        const pool = await poolPromise; // Await the pool promise
        const query = 'INSERT INTO PDF_table (claimID, pdf_url, pdf_description) VALUES (@claimID, @pdfUrl, @pdfDescription)';
        await pool.request()
            .input('claimID', sql.VarChar, claimID)
            .input('pdfUrl', sql.VarChar, pdfUrl)
            .input('pdfDescription', sql.VarChar, pdfDescription)
            .query(query);
        console.log(`PDF entry created for Claim ID: ${claimID}`);
    } catch (err) {
        console.error('Error inserting PDF: ', err);
        throw err;
    }
};

// Function to insert image URLs into Image table
const insertImages = async (claimID, imageUrlList, analysisResults) => {
    try {
        const pool = await poolPromise;
        const query = 'INSERT INTO Image_table (claimID, image_url, image_status, image_description) VALUES (@claimID, @imageUrl, @imageStatus, @imageDescription)';

        for (const [index, imageUrl] of imageUrlList.entries()) {
            const analysisResult = analysisResults[index];
            await pool.request()
                .input('claimID', sql.VarChar, claimID)
                .input('imageUrl', sql.VarChar, imageUrl)
                .input('imageStatus', sql.VarChar, analysisResult.analysisResult['Claim Status'].status)
                .input('imageDescription', sql.VarChar, analysisResult.analysisResult['Evidence Content'])
                .query(query);
        }
        console.log(`Image entries created for Claim ID: ${claimID}`);
    } catch (err) {
        console.error('Error inserting images: ', err);
        throw err;
    }
};

// Function to insert claim status and AI-status into Claim table
const insertClaimStatus = async (claimID, aiStatus) => {
    try {
        const pool = await poolPromise;
        const query = 'INSERT INTO Claim_table (claimID, status, ai_status) VALUES (@claimID, @status, @aiStatus)';
        await pool.request()
            .input('claimID', sql.VarChar, claimID)
            .input('status', sql.VarChar, null)  // Assuming status is null initially
            .input('aiStatus', sql.VarChar, aiStatus)
            .query(query);
        console.log(`Claim status created for Claim ID: ${claimID}`);
    } catch (err) {
        console.error('Error inserting claim status: ', err);
        throw err;
    }
};

// Function to handle the entire database transaction
const processTransaction = async (claimID, pdfUrl, imageUrlList, aiStatus, analyzedText, analysisResults) => {
    let transaction;
    try {
        // Wait for the connection pool to be ready
        const pool = await poolPromise;

        // Start a transaction
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const request = new sql.Request(transaction);

        // Step 1: Insert PDF URL and pdf_description into PDF table
        await request
            .input('claimID', sql.VarChar, claimID)
            .input('pdfUrl', sql.VarChar, pdfUrl)
            .input('pdfDescription', sql.VarChar, analyzedText["Reason"])  // Using analyzed text's reason
            .query('INSERT INTO PDF_table (claimID, pdf_url, pdf_description) VALUES (@claimID, @pdfUrl, @pdfDescription)');

        // Clear parameters to avoid duplicates
        request.parameters = {}; 

        // Step 2: Insert each image URL, image_status, and image_description
        for (const [index, imageUrl] of imageUrlList.entries()) {
            const analysisResult = analysisResults[index];

            await request
                .input('claimID', sql.VarChar, claimID)
                .input('imageUrl', sql.VarChar, imageUrl)
                .input('imageStatus', sql.VarChar, analysisResult.analysisResult['Claim Status'].status)
                .input('imageDescription', sql.VarChar, analysisResult.analysisResult['Evidence Content'])
                .query('INSERT INTO Image_table (claimID, image_url, image_status, image_description) VALUES (@claimID, @imageUrl, @imageStatus, @imageDescription)');

            // Clear parameters for each image insert to avoid duplicates
            request.parameters = {};
        }

        // Step 3: Insert claim status and AI-status into Claim table
        await request
            .input('claimID', sql.VarChar, claimID)
            .input('status', sql.VarChar, null)  // Assuming status is initially null
            .input('aiStatus', sql.VarChar, aiStatus)
            .query('INSERT INTO Claim_table (claimID, status, ai_status) VALUES (@claimID, @status, @aiStatus)');

        // Commit the transaction if all queries succeed
        await transaction.commit();
        console.log("Transaction committed successfully for Claim ID:", claimID);
    } catch (error) {
        // If there's an error, roll back the transaction
        if (transaction) {
            await transaction.rollback();
        }
        console.error("Transaction failed: ", error);
        throw error;
    }
};

module.exports = {
    insertPdf,
    insertImages,
    insertClaimStatus,
    processTransaction,
};
