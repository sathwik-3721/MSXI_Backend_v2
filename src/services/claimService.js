const sql = require('mssql');
const poolPromise = require('../config/db'); // Import the database connection

// Function to get claim details by ID
const getClaimsByID = async (claim_id) => {
    try {
        const pool = await poolPromise; // Await the pool promise
        
        // Query to get claim details from the Claim_table
        const claimQuery = `
            SELECT 
                c.claimID as id
            FROM 
                Claim_table c
            WHERE 
                c.claimID = @claimID;
        `;
        const claimResult = await pool.request()
            .input('claimID', sql.VarChar, claim_id)
            .query(claimQuery);

        // If no rows are returned from Claim_table, return a message indicating no claims found
        if (claimResult.recordset.length === 0) {
            return { message: `No claims found for claimID: ${claim_id}` };
        }

        const claim = claimResult.recordset[0];
        const claimID = claim.id;

        // Query to get PDF details for the specified claimID
        const pdfQuery = `
            SELECT 
                p.pdf_url as pdfURL,
                p.pdf_description as pdfDesc
            FROM 
                PDF_table p
            WHERE 
                p.claimID = @claimID;
        `;
        const pdfResult = await pool.request()
            .input('claimID', sql.VarChar, claimID)
            .query(pdfQuery);

        // Query to get Image details for the specified claimID, including image description
        const imageQuery = `
            SELECT 
                i.image_url as imageURL,
                i.image_status as imageStatus,
                i.image_description as imageDesc
            FROM 
                Image_table i
            WHERE 
                i.claimID = @claimID;
        `;
        const imageResult = await pool.request()
            .input('claimID', sql.VarChar, claimID)
            .query(imageQuery);

        // Combine the results
        const claimDetails = {
            id: claimID,
            pdfURL: pdfResult.recordset.length > 0 ? pdfResult.recordset[0].pdfURL : null,
            pdfDesc: pdfResult.recordset.length > 0 ? pdfResult.recordset[0].pdfDesc : null,
            imageURL: imageResult.recordset.map(row => row.imageURL),
            imageStatus: imageResult.recordset.map(row => row.imageStatus),
            imageDesc: imageResult.recordset.map(row => row.imageDesc)  // Include image descriptions
        };

        console.log("claimDetails ", claimDetails);

        // Return the combined claim details
        return claimDetails;
    } catch (error) {
        console.error('Error fetching claims:', error.message);
        throw new Error('Error fetching claims.');
    }
};

// Function to get all claim IDs
const getClaimIDs = async () => {
    try {
        const pool = await poolPromise; // Await the pool promise
        const query = `
            SELECT DISTINCT claimID as id
            FROM Claim_table;
        `;

        const result = await pool.request().query(query);

        // Format the results into the desired JSON structure
        const claimIDs = result.recordset.map(row => ({
            id: row.id
        }));

        // Return claimIDs if not empty, otherwise return a message
        if (claimIDs.length === 0) {
            return { message: 'No claims found.' };
        }

        return claimIDs;
    } catch (error) {
        console.error('Error fetching claim IDs:', error.message);
        throw new Error('Error fetching claim IDs.');
    }
};

// Function to update the status of a claim
const updateClaimStatus = async (claimID, status) => {
    try {
        const pool = await poolPromise; // Await the pool promise
        const query = `
            UPDATE Claim_table 
            SET status = @status
            WHERE claimID = @claimID;
        `;

        const result = await pool.request()
            .input('status', sql.VarChar, status)
            .input('claimID', sql.VarChar, claimID)
            .query(query);

        // Check if any rows were affected (i.e., if the update was successful)
        if (result.rowsAffected[0] === 0) {
            throw new Error('Claim ID not found.');
        }

        return { message: 'Status updated successfully.' };
    } catch (error) {
        console.error('Error updating claim status:', error.message);
        throw new Error('Error updating claim status.');
    }
};

module.exports = { getClaimsByID, getClaimIDs, updateClaimStatus };
