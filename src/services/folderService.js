const { Storage } = require('@google-cloud/storage');
const pool = require('../config/db') // Import the dbConfig
const storage = new Storage();
require('dotenv').config();

const bucketName = process.env.BUCKET_NAME; // Replace with your actual bucket name

const deleteFolderFromBucket = async (claimID) => {
    const folderPrefix = `${claimID}/`;

    // Get all the files in the folder
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: folderPrefix });

    if (files.length === 0) {
        throw new Error('No files found for the provided Claim ID.');
    }

    // Delete all files in the folder
    await Promise.all(files.map(file => file.delete()));
};

const deleteRecordsFromTables = async (claimID) => {
    const connection = await pool.getConnection(); // Get a connection from the pool

    try {
        await connection.beginTransaction();

        // Delete from PDF_table
        await connection.query('DELETE FROM PDF_table WHERE claimID = ?', [claimID]);

        // Delete from Image_table
        await connection.query('DELETE FROM Image_table WHERE claimID = ?', [claimID]);

        // Delete from Claim_table
        await connection.query('DELETE FROM Claim_table WHERE claimID = ?', [claimID]);

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw new Error('Error deleting records from tables: ' + error.message);
    } finally {
        connection.release(); // Release the connection back to the pool
    }
};

const deleteFolderAndRecords = async (claimID) => {
    await deleteRecordsFromTables(claimID);
    await deleteFolderFromBucket(claimID);
};

module.exports = { deleteFolderAndRecords };
