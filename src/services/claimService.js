const pool = require('../config/db');

const getClaimsByID = async (claim_id) => {
    const connection = await pool.getConnection();

    try {
        console.log("claim id :", claim_id);
        // Query to get claim details from the Claim_table
        const [claimRows] = await connection.query(`
            SELECT 
                c.claimID as id
            FROM 
                Claim_table c
            WHERE 
                c.claimID = ?;`, [claim_id]);

        // If no rows are returned from Claim_table, return a message indicating no claims found
        if (claimRows.length === 0) {
            return { message: `No claims found for claimID: ${claim_id}` };
        }

        const claim = claimRows[0];
        const claimID = claim.id;

        // Query to get PDF details for the specified claimID
        const [pdfRows] = await connection.query(`
            SELECT 
                p.pdf_url as pdfURL,
                p.pdf_description as pdfDesc
            FROM 
                PDF_table p
            WHERE 
                p.claimID = ?;`, [claimID]);

        // Query to get Image details for the specified claimID
        const [imageRows] = await connection.query(`
            SELECT 
                i.image_url as imageURL,
                i.image_status as imageStatus
            FROM 
                Image_table i
            WHERE 
                i.claimID = ?;`, [claimID]);

        // Combine the results
        const claimDetails = {
            id: claimID,
            pdfURL: pdfRows.length > 0 ? pdfRows[0].pdfURL : null,
            pdfDesc: pdfRows.length > 0 ? pdfRows[0].pdfDesc : null,
            imageURL: imageRows.map(row => row.imageURL),
            imageStatus: imageRows.map(row => row.imageStatus)
        };

        console.log("claimDetails ", claimDetails);

        // Return the combined claim details
        return claimDetails;
    } catch (error) {
        console.error('Error fetching claims:', error.message);
        throw new Error('Error fetching claims.');
    } finally {
        connection.release();
    }
};


const getClaimIDs = async () => {
    const connection = await pool.getConnection();

    try {
        // Query to get the claimID from Claim_table
        const [rows] = await connection.query(`
            SELECT 
                DISTINCT claimID as id
            FROM 
                Claim_table;
        `);

        // Format the results into the desired JSON structure
        const claimIDs = rows.map(row => ({
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
    } finally {
        connection.release();
    }
};

const updateClaimStatus = async (claimID, status) => {
    const connection = await pool.getConnection();

    try {
        // Update the status in Claim_table where claimID matches
        const [result] = await connection.query(`
            UPDATE Claim_table 
            SET status = ?
            WHERE claimID = ?;
        `, [status, claimID]);

        // Check if any rows were affected (i.e., if the update was successful)
        if (result.affectedRows === 0) {
            throw new Error('Claim ID not found.');
        }

        return { message: 'Status updated successfully.' };
    } catch (error) {
        console.error('Error updating claim status:', error.message);
        throw new Error('Error updating claim status.');
    } finally {
        connection.release();
    }
};

module.exports = { getClaimsByID, getClaimIDs, updateClaimStatus };
