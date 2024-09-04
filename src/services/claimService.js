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

module.exports = { getClaims };
