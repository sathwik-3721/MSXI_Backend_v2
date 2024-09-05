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
const processTransaction = async (claimID, pdfUrl, imageUrlList, aiStatus) => {
    const connection = await pool.getConnection();
    try {
        console.log("Started adding to table");
        await connection.beginTransaction();

        // Insert PDF
        await insertPdf(claimID, pdfUrl);

        // Insert each image URL
        await insertImages(claimID, imageUrlList);

        // Insert claim status and AI-status
        await insertClaimStatus(claimID, aiStatus);

        await connection.commit();
        console.log("Transaction committed successfully");
    } catch (error) {
        await connection.rollback();
        console.error("Transaction failed, rolled back", error);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    processTransaction,
};
