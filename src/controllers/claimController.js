const { getClaims } = require('../services/claimService');

const getClaimsHandler = async (req, res) => {
    try {
        const claims = await getClaims();

        // Check if the response contains a message indicating no claims were found
        if (claims.message) {
            return res.status(404).json({ message: claims.message });
        }

        return res.status(200).json(claims);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { getClaimsHandler };
