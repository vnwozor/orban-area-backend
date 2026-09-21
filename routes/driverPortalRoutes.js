import express from 'express'
import {
    getMe,
    updateMe,
    updateVehicle,
    setAvailability,
    getRequests,
    getTrips,
    getHistory,
    getPassengers,
    getEarnings,
    acceptBooking,
    declineBooking,
    updateTripStatus,
} from '../controllers/driverPortalController.js'
import { requireAuth } from '../middleware/auth.js'

// Everything the driver app needs for "me". Mounted at /api/driver (singular).
const router = express.Router()
router.use(requireAuth('driver'))

router.get('/me', getMe)
router.put('/me', updateMe)
router.put('/vehicle', updateVehicle)
router.patch('/availability', setAvailability)

router.get('/requests', getRequests)
router.get('/trips', getTrips)
router.get('/history', getHistory)
router.get('/passengers', getPassengers)
router.get('/earnings', getEarnings)

router.patch('/bookings/:id/accept', acceptBooking)
router.patch('/bookings/:id/decline', declineBooking)
router.patch('/bookings/:id/status', updateTripStatus)

export default router
