const express = require('express');
const { mesNotifications, marquerLue } = require('../controllers/notificationsController');
const { authentifier } = require('../middlewares/auth');

const router = express.Router();

router.get('/', authentifier, mesNotifications);
router.post('/:id/lue', authentifier, marquerLue);

module.exports = router;
