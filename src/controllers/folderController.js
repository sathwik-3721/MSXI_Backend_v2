const { deleteFolderAndRecords } = require('../services/folderService');

const deleteFolder = async (req, res) => {
    try {
        const { claimID } = req.params;

        if (!claimID) {
            return res.status(400).send('Claim ID is required.');
        }

        await deleteFolderAndRecords(claimID);

        return res.status(200).send(`Folder and all related records with Claim ID ${claimID} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting folder and records:', error.message);
        return res.status(500).send('An error occurred while deleting the folder and records.');
    }
};

module.exports = { deleteFolder };
