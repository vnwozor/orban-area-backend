import Notification from '../models/Notification.js'
import { asyncHandler, HttpError } from '../utils/http.js'
import { serializeNotification } from '../utils/serialize.js'

const mine = (req) => ({ recipientType: req.role, recipient: req.account._id })

// GET /api/notifications  (rider or driver)  ->  { unread, items }
export const listNotifications = asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
        Notification.find(mine(req)).sort({ createdAt: -1 }).limit(50),
        Notification.countDocuments({ ...mine(req), read: false }),
    ])
    res.json({ unread, items: items.map(serializeNotification) })
})

// GET /api/notifications/unread-count - cheap, used for the bell badge
export const unreadCount = asyncHandler(async (req, res) => {
    res.json({ unread: await Notification.countDocuments({ ...mine(req), read: false }) })
})

// PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
    await Notification.updateMany({ ...mine(req), read: false }, { read: true })
    res.json({ unread: 0 })
})

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, ...mine(req) }, { read: true }, { new: true })
    if (!n) throw new HttpError(404, 'Notification not found')
    res.json(serializeNotification(n))
})
