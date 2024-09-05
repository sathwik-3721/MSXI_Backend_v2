const pool = require('../config/db');

const getClaims = async () => {
    const connection = await pool.getConnection();
    console.log("conn", connection);

    try {
        // Query to get the claim ID, PDF URL, and image URL
        const [rows] = await connection.query(`
            SELECT 
                c.claimID as id,
                p.pdf_url as pdfURL,
                i.image_url as imageURL
            FROM 
                Claim_table c
            LEFT JOIN 
                PDF_table p ON c.claimID = p.claimID
            LEFT JOIN 
                Image_table i ON c.claimID = i.claimID;
        `);
        // console.log("rows", rows);

        // Format the results into the desired JSON structure
        const claims = rows.map(row => ({
            id: row.id,
            pdfURL: row.pdfURL,
            imageURL: row.imageURL
        }));

        console.log("claims ", claims);

        // Return claims if not empty, otherwise return a message
        if (claims.length === 0) {
            return { message: 'No claims found.' };
        }

        return claims;
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

module.exports = { getClaims, getClaimIDs, updateClaimStatus };
