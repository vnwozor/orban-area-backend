import express from 'express'
import {
    createUser,
    loginUser,
    sendUserOtp,
    verifyUserOtp,
    oauthLoginUser,
    getUser,
    updateUserLocation,
    getUserStats,
    updateUserProfile,
    updateEmergencyContact,
    addTraveler,
    updateTraveler,
    removeTraveler,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
} from '../controllers/userController.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// --- Registration & login ---
router.post('/', createUser) // email/password sign up
router.post('/login', loginUser) // email/password login
router.post('/otp/send', sendUserOtp) // phone OTP: step 1
router.post('/otp/verify', verifyUserOtp) // phone OTP: step 2 (signs up or logs in)
router.post('/oauth', oauthLoginUser) // Google/Apple sign-in via Firebase ID token

// --- Reads ---
router.get('/:id', getUser)
router.get('/:id/stats', getUserStats)

// --- Location (unchanged) ---
router.patch('/:id/location', updateUserLocation)

// --- Profile management (auth required, owner-only) ---
router.patch('/:id/profile', requireAuth('user'), updateUserProfile)
router.patch('/:id/emergency-contact', requireAuth('user'), updateEmergencyContact)

// --- Saved travelers ---
router.post('/:id/travelers', requireAuth('user'), addTraveler)
router.patch('/:id/travelers/:travelerId', requireAuth('user'), updateTraveler)
router.delete('/:id/travelers/:travelerId', requireAuth('user'), removeTraveler)

// --- Payment wallet (demo tokens only) ---
router.post('/:id/payment-methods', requireAuth('user'), addPaymentMethod)
router.delete('/:id/payment-methods/:methodId', requireAuth('user'), removePaymentMethod)
router.patch('/:id/payment-methods/:methodId/default', requireAuth('user'), setDefaultPaymentMethod)

export default router
