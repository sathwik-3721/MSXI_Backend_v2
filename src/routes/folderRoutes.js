const express = require('express');
const router = express.Router();
const { deleteFolder } = require('../controllers/folderController');

router.delete('/delete-folder/:claimID', deleteFolder);

module.exports = router;
