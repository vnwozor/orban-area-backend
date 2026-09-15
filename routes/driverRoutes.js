import express from 'express'
import {
    createDriver,
    loginDriver,
    getDrivers,
    getDriver,
    updateDriverLocation,
    setDriverAvailability,
    getDriverStats,
} from '../controllers/driverController.js'

const router = express.Router()

router.post('/', createDriver) // registration
router.post('/login', loginDriver)
router.get('/', getDrivers) // ?available=true
router.get('/:id', getDriver)
router.patch('/:id/location', updateDriverLocation)
router.patch('/:id/availability', setDriverAvailability)
router.get('/:id/stats', getDriverStats)

export default router
