import mongoose from 'mongoose'

// One collection for both riders and drivers: recipientType says which
// collection `recipient` points at.
const notificationSchema = new mongoose.Schema(
    {
        recipientType: { type: String, enum: ['user', 'driver'], required: true },
        recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        kind: { type: String, enum: ['request', 'payment', 'cancel', 'status', 'system'], default: 'system' },
        title: { type: String, required: true },
        body: { type: String, default: '' },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
)

notificationSchema.index({ recipientType: 1, recipient: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
