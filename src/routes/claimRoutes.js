const express = require('express');
const router = express.Router();

const { getClaimsHandler } = require('../controllers/claimController')

router.get('/getClaims', getClaimsHandler);

module.exports = router;
