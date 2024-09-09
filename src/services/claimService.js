const sql = require('mssql');
const poolPromise = require('../config/db'); // Import the database connection

// Function to get claim details by ID
const getClaimsByID = async (claim_id) => {
    try {
        const pool = await poolPromise; // Await the pool promise

        // Optimized SQL query to fetch claim, PDF, and image details in one go
        const query = `
            SELECT 
                c.claimID as id,
                c.ai_status as aiStatus,
                p.pdf_url as pdfURL,
                p.pdf_description as pdfDesc,
                i.image_url as imageURL,
                i.image_status as imageStatus,
                i.image_description as imageDesc
            FROM 
                Claim_table c
            LEFT JOIN 
                PDF_table p ON c.claimID = p.claimID
            LEFT JOIN 
                Image_table i ON c.claimID = i.claimID
            WHERE 
                c.claimID = @claimID;
        `;

        const result = await pool.request()
            .input('claimID', sql.VarChar, claim_id)
            .query(query);

        if (result.recordset.length === 0) {
            return { message: `No claims found for claimID: ${claim_id}` };
        }

        // Grouping PDF and image details
        const claimDetails = {
            id: result.recordset[0].id,
            aiStatus:result.recordset[0].aiStatus,
            pdf: result.recordset[0].pdfURL ? {
                url: result.recordset[0].pdfURL,
                description: result.recordset[0].pdfDesc
            } : null,
            images: result.recordset.filter(row => row.imageURL).map(row => ({
                url: row.imageURL,
                status: row.imageStatus,
                description: row.imageDesc
            }))
        };

        // console.log("claimDetails:", claimDetails);

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
            SELECT DISTINCT claimID as id, ai_status as AiStatus
            FROM Claim_table;
        `;

        const result = await pool.request().query(query);

        // Format the results into the desired JSON structure
        const claimIDs = result.recordset.map(row => ({
            id: row.id,
            aiStatus: row.AiStatus
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
