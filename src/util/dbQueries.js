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

        // Step 1: Insert PDF URL and pdf_description into PDF table
        let pdfRequest = new sql.Request(transaction);
        const pdfDescription = analyzedText["Reason "] || analyzedText["Reason"];
        await pdfRequest
            .input('claimID', sql.VarChar, claimID)
            .input('pdfUrl', sql.VarChar, pdfUrl)
            .input('pdfDescription', sql.VarChar, pdfDescription)
            .query(`
                INSERT INTO PDF_table (claimID, pdf_url, pdf_description)
                VALUES (@claimID, @pdfUrl, @pdfDescription)
            `);

        // Step 2: Batch insert image URLs and analysis results into Image table
        let imageRequest = new sql.Request(transaction);
        const imageInsertQuery = `
            INSERT INTO Image_table (claimID, image_url, image_status, image_description)
            VALUES ${imageUrlList.map((_, index) => `(@claimID, @imageUrl${index}, @imageStatus${index}, @imageDescription${index})`).join(', ')}
        `;

        // Dynamically prepare image parameters
        imageUrlList.forEach((imageUrl, index) => {
            const analysisResult = analysisResults[index];
            imageRequest
                .input(`imageUrl${index}`, sql.VarChar, imageUrl)
                .input(`imageStatus${index}`, sql.VarChar, analysisResult.analysisResult['Claim Status'].status)
                .input(`imageDescription${index}`, sql.VarChar, analysisResult.analysisResult['Evidence Content']);
        });

        await imageRequest
            .input('claimID', sql.VarChar, claimID)
            .query(imageInsertQuery);

        // Step 3: Insert claim status and AI-status into Claim table
        let claimRequest = new sql.Request(transaction);
        await claimRequest
            .input('claimID', sql.VarChar, claimID)
            .input('status', sql.VarChar, null)  // Assuming status is initially null
            .input('aiStatus', sql.VarChar, aiStatus)
            .query(`
                INSERT INTO Claim_table (claimID, status, ai_status)
                VALUES (@claimID, @status, @aiStatus)
            `);

        // Commit the transaction if all queries succeed
        await transaction.commit();
    } catch (error) {
        // Roll back the transaction if an error occurs
        if (transaction) {
            await transaction.rollback();
        }
        console.error("Transaction failed:", error);
        throw error;
    }
};

const getPDFDescription = async (claimID) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('claimID', sql.VarChar, claimID)
            .query('SELECT pdf_description FROM PDF_table WHERE claimID = @claimID');
        return result.recordset[0] || null;
    } catch (error) {
        console.error("Error fetching PDF description:", error.message);
        throw error;
    }
};

// Helper function to get image descriptions from database
const getImageDescriptions = async (claimID) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('claimID', sql.VarChar, claimID)
            .query('SELECT image_description FROM Image_table WHERE claimID = @claimID');
        return result;
    } catch (error) {
        console.error("Error fetching image descriptions:", error.message);
        throw error;
    }
};

module.exports = {
    insertPdf,
    insertImages,
    insertClaimStatus,
    processTransaction,
    getPDFDescription,
    getImageDescriptions

};
