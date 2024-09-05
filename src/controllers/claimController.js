const { getClaims, getClaimIDs, updateClaimStatus   } = require('../services/claimService');

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

const getClaimIDsHandler = async (req, res) => {
    try {
        const claimIDs = await getClaimIDs();

        // Check if the response contains a message indicating no claims were found
        if (claimIDs.message) {
            return res.status(404).json({ message: claimIDs.message });
        }

        return res.status(200).json(claimIDs);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateClaimStatusHandler = async (req, res) => {
    const { claimID, status } = req.body;

    // Validate the input
    if (!claimID || !status) {
        return res.status(400).json({ message: 'Claim ID and status are required.' });
    }

    try {
        const result = await updateClaimStatus(claimID, status);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { getClaimsHandler, getClaimIDsHandler, updateClaimStatusHandler };
