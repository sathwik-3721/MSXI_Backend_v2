const pool = require('../config/db'); // Importing the database connection

// Function to insert PDF URL into PDF table
const insertPdf = async (claimID, pdfUrl) => {
    const query = 'INSERT INTO PDF_table (claimID, pdf_url) VALUES (?, ?)';
    const params = [claimID, pdfUrl];
    const connection = await pool.getConnection();
    try {
        await connection.query(query, params);
    } finally {
        connection.release();
    }
};

// Function to insert image URLs into Image table
const insertImages = async (claimID, imageUrlList) => {
    const query = 'INSERT INTO Image_table (claimID, image_url) VALUES (?, ?)';
    const connection = await pool.getConnection();
    try {
        for (const imageUrl of imageUrlList) {
            await connection.query(query, [claimID, imageUrl]);
        }
    } finally {
        connection.release();
    }
};

// Function to insert claim status and AI-status into Claim table
const insertClaimStatus = async (claimID, aiStatus) => {
    const query = 'INSERT INTO Claim_table (claimID, status, ai_status) VALUES (?, ?, ?)';
    const params = [claimID, null, aiStatus];
    const connection = await pool.getConnection();
    try {
        await connection.query(query, params);
    } finally {
        connection.release();
    }
};

// Function to handle the entire database transaction
const processTransaction = async (claimID, pdfUrl, imageUrlList, aiStatus, analyzedText, analysisResults) => {
    const connection = await pool.getConnection();
    try {
        console.log("Started adding to table");
        await connection.beginTransaction();

        // Step 1: Insert PDF URL and pdf_description (reason) into PDF table
        await connection.query(
            'INSERT INTO PDF_table (claimID, pdf_url, pdf_description) VALUES (?, ?, ?)',
            [claimID, pdfUrl, analyzedText["Reason"]]
        );

        // Step 2: Insert each image URL, image_status, image_description, and reason into Image table
        for (const [index, imageUrl] of imageUrlList.entries()) {
            const analysisResult = analysisResults[index]; // Get the corresponding analysis result
            console.log("Analysis result:", analysisResult);
            await connection.query(
                'INSERT INTO Image_table (claimID, image_url, image_status, image_description) VALUES (?, ?, ?, ?)',
                [claimID, imageUrl, analysisResult.analysisResult['Claim Status'].status, analysisResult.analysisResult['Evidence Content']]
            );
        }

        // Step 3: Insert claim status and AI-status into Claim table
        await connection.query(
            'INSERT INTO Claim_table (claimID, status, ai_status) VALUES (?, ?, ?)',
            [claimID, null, aiStatus]
        );

        await connection.commit();
        console.log("Finished adding into table");
    } catch (error) {
        await connection.rollback();
        console.error("Transaction failed: ", error);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    processTransaction,
};
