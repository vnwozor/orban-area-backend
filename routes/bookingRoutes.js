import express from 'express'
import { createBooking, getMyBookings, getBooking, cancelBooking } from '../controllers/bookingController.js'
import { requireAuth, requireAnyAuth } from '../middleware/auth.js'

const router = express.Router()

router.post('/', requireAuth('user'), createBooking)
router.get('/mine', requireAuth('user'), getMyBookings) // must stay above '/:id'
router.get('/:id', requireAnyAuth, getBooking)
// :id here is a booking id, not the rider's account id
router.patch('/:id/cancel', requireAuth('user', { matchParamId: false }), cancelBooking)

export default router
