import express from 'express'
import {
    createDriver,
    loginDriver,
    sendDriverOtp,
    verifyDriverOtp,
    oauthLoginDriver,
    getDrivers,
    getDriver,
    updateDriverLocation,
    setDriverAvailability,
    getDriverStats,
    updateDriverProfile,
    updateDriverEmergencyContact,
} from '../controllers/driverController.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// --- Registration & login ---
router.post('/', createDriver) // email/password sign up
router.post('/login', loginDriver) // email/password login
router.post('/otp/send', sendDriverOtp) // phone OTP: step 1
router.post('/otp/verify', verifyDriverOtp) // phone OTP: step 2 (signs up or logs in)
router.post('/oauth', oauthLoginDriver) // Google/Apple sign-in via Firebase ID token

// --- Reads ---
router.get('/', getDrivers) // ?available=true
router.get('/:id', getDriver)
router.get('/:id/stats', getDriverStats)

// --- Location / availability (unchanged) ---
router.patch('/:id/location', updateDriverLocation)
router.patch('/:id/availability', setDriverAvailability)

// --- Profile management (auth required, owner-only) ---
router.patch('/:id/profile', requireAuth('driver'), updateDriverProfile)
router.patch('/:id/emergency-contact', requireAuth('driver'), updateDriverEmergencyContact)

export default router
