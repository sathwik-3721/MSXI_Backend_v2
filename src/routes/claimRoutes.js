const express = require('express');
const router = express.Router();

const { getClaimsHandler, getClaimIDsHandler, updateClaimStatusHandler   } = require('../controllers/claimController')

router.get('/getClaims', getClaimsHandler);
router.get('/getClaimIDs', getClaimIDsHandler);
router.put('/updateStatus', updateClaimStatusHandler);

module.exports = router;
