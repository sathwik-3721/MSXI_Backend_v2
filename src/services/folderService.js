const { Storage } = require('@google-cloud/storage');
const sql = require('mssql'); // Import the mssql package
const poolPromise = require('../config/db'); // Import the MSSQL connection pool
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
    const pool = await poolPromise; // Get a pool instance

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // Delete from PDF_table
        await transaction.request().input('claimID', sql.VarChar, claimID)
            .query('DELETE FROM PDF_table WHERE claimID = @claimID');

        // Delete from Image_table
        await transaction.request().input('claimID', sql.VarChar, claimID)
            .query('DELETE FROM Image_table WHERE claimID = @claimID');

        // Delete from Claim_table
        await transaction.request().input('claimID', sql.VarChar, claimID)
            .query('DELETE FROM Claim_table WHERE claimID = @claimID');

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw new Error('Error deleting records from tables: ' + error.message);
    }
};

const deleteFolderAndRecords = async (claimID) => {
    await deleteRecordsFromTables(claimID);
    await deleteFolderFromBucket(claimID);
};

module.exports = { deleteFolderAndRecords };
    