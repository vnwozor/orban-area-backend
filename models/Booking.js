import mongoose from 'mongoose'

const locationSchema = new mongoose.Schema(
    {
        address: { type: String, default: '' },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    { _id: false }
)

// A snapshot of the car at booking time, so a booking still reads correctly
// after the driver edits or replaces their vehicle.
const carSnapshotSchema = new mongoose.Schema(
    {
        model: String,
        year: Number,
        type: String,
        seats: Number,
        plateNumber: String,
        color: String,
    },
    { _id: false }
)

const fareSchema = new mongoose.Schema(
    {
        distanceKm: Number,
        durationMin: Number,
        pricePerKm: Number,
        base: Number,
        distance: Number,
        service: Number,
        total: { type: Number, required: true },
    },
    { _id: false }
)

// Mock payment record - the raw card number and CVV are never stored.
const paymentSchema = new mongoose.Schema(
    {
        method: { type: String, enum: ['card', 'bank', 'cash'], required: true },
        status: { type: String, enum: ['paid', 'pay_on_pickup', 'refunded'], required: true },
        reference: { type: String, default: null },
        brand: { type: String, default: null },
        last4: { type: String, default: null },
        amount: { type: Number, required: true },
        paidAt: { type: Date, default: null },
    },
    { _id: false }
)

export const BOOKING_STATUSES = ['pending', 'accepted', 'arrived', 'started', 'completed', 'cancelled', 'declined']
export const UPCOMING_STATUSES = ['pending', 'accepted', 'arrived', 'started']
export const LIVE_STATUSES = ['accepted', 'arrived', 'started']

const bookingSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true }, // e.g. BK-48213
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },

        pickup: { type: locationSchema, required: true },
        destination: { type: locationSchema, required: true },

        date: { type: String, required: true }, // YYYY-MM-DD (Lagos)
        time: { type: String, required: true }, // HH:mm (Lagos)
        scheduledAt: { type: Date, required: true, index: true },
        passengers: { type: Number, required: true, min: 1 },

        car: { type: carSnapshotSchema, required: true },
        fare: { type: fareSchema, required: true },
        payment: { type: paymentSchema, required: true },

        status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
        cancelledBy: { type: String, enum: ['user', 'driver', null], default: null },

        acceptedAt: Date,
        completedAt: Date,
        cancelledAt: Date,
    },
    { timestamps: true }
)

// BK- + 5 digits. Retries a few times in the (unlikely) event of a clash.
bookingSchema.statics.generateCode = async function () {
    for (let i = 0; i < 8; i++) {
        const code = `BK-${Math.floor(10000 + Math.random() * 90000)}`
        if (!(await this.exists({ code }))) return code
    }
    return `BK-${Date.now().toString().slice(-8)}`
}

export default mongoose.model('Booking', bookingSchema)
