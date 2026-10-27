const express = require('express');
const ctrl = require('../controllers/auditController');
const { authentifier, autoriserRoles } = require('../middlewares/auth');

const router = express.Router();

router.get('/', authentifier, autoriserRoles('superadmin', 'academie'), ctrl.lister);
router.get('/integrite', authentifier, autoriserRoles('superadmin', 'academie'), ctrl.integrite);

module.exports = router;
