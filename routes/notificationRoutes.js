import express from 'express'
import { listNotifications, unreadCount, markAllRead, markRead } from '../controllers/notificationController.js'
import { requireAnyAuth } from '../middleware/auth.js'

const router = express.Router()
router.use(requireAnyAuth)

router.get('/', listNotifications)
router.get('/unread-count', unreadCount)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markRead)

export default router
