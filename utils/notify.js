import Notification from '../models/Notification.js'

// Fire-and-forget: a failed notification must never fail the booking itself.
export const notify = async ({ to, id, kind = 'system', title, body = '', booking = null }) => {
    try {
        await Notification.create({ recipientType: to, recipient: id, kind, title, body, booking })
    } catch (err) {
        console.error('[notify] could not save notification:', err.message)
    }
}
