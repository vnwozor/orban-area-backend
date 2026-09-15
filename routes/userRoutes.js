import express from 'express'
import { createUser, loginUser, getUser, updateUserLocation, getUserStats } from '../controllers/userController.js'

const router = express.Router()

router.post('/', createUser)
router.post('/login', loginUser)
router.get('/:id', getUser)
router.get('/:id/stats', getUserStats)
router.patch('/:id/location', updateUserLocation)

export default router
