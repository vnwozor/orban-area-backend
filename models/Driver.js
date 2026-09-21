import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const locationSchema = new mongoose.Schema(
    {
        address: { type: String },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    { _id: false }
)



const carSchema = new mongoose.Schema(
    {
        model: { type: String, default: '' },
        year: { type: Number, default: null },
        type: { type: String, default: 'Sedan' }, // Compact | Sedan | SUV | Van
        color: { type: String, default: '#3B4A66' },
        plateNumber: { type: String, required: true },
        // Leave this out and the fare uses the default rate for the car type
        // (see utils/fare.js).
        pricePerKm: { type: Number, default: null },
        seats: { type: Number, default: 4, min: 1, max: 14 },
        photo: { type: String, default: null }, // small image as a data URL
    },
    { _id: false }
)

const VERIFICATION_STATES = ['pending', 'verified', 'rejected']
const verificationSchema = new mongoose.Schema(
    {
        license: { type: String, enum: VERIFICATION_STATES, default: 'pending' },
        vehicleRegistration: { type: String, enum: VERIFICATION_STATES, default: 'pending' },
        identity: { type: String, enum: VERIFICATION_STATES, default: 'pending' },
    },
    { _id: false }
)

const emergencyContactSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String, default: '' },
    },
    { _id: false }
)

const driverSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, unique: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: [6, 'Password must be at least 6 characters'], select: false },
        role: { type: String, default: 'driver' },
        driverId: { type: String, unique: true, sparse: true }, // e.g. DRV-20481
        photo: { type: String, default: null }, // profile photo as a small data URL
        rating: { type: Number, default: 5 },
        // "available" is the Online / Offline switch. Riders can only book
        // a car whose driver is online.
        available: { type: Boolean, default: true },
        verification: { type: verificationSchema, default: () => ({}) },
        currentLocation: locationSchema,
        car: carSchema,

        emergencyContact: emergencyContactSchema,
    },
    { timestamps: true }
)

// Give every new driver a Driver ID (DRV-12345) unless a valid one was sent.
driverSchema.pre('validate', async function (next) {
    if (this.driverId) return next()
    for (let i = 0; i < 8; i++) {
        const candidate = `DRV-${Math.floor(10000 + Math.random() * 90000)}`
        if (!(await this.constructor.exists({ driverId: candidate }))) {
            this.driverId = candidate
            return next()
        }
    }
    this.driverId = `DRV-${Date.now().toString().slice(-8)}`
    next()
})

driverSchema.virtual('isVerified').get(function () {
    const v = this.verification || {}
    return v.license === 'verified' && v.vehicleRegistration === 'verified' && v.identity === 'verified'
})
driverSchema.set('toObject', { virtuals: true })
driverSchema.set('toJSON', { virtuals: true })

driverSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

driverSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('Driver', driverSchema)
