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
        type: { type: String, default: '' },
        plateNumber: { type: String, required: true },
        pricePerKm: { type: Number, default: 15 },
        seats: { type: Number, default: 4 },
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
        name: { type: String, required: true },
        phone: { type: String, required: true, unique: true },
        email: {
            type: String,
            unique: true,
            sparse: true,
        },
        // Not required: OTP-only and OAuth-only accounts have no password
        password: {
            type: String,
            select: false,
            required: function () {
                return !this.googleId && !this.appleId
            },
        },
        role: { type: String, default: 'driver' },
        rating: { type: Number, default: 5 },
        available: { type: Boolean, default: true },
        currentLocation: locationSchema,
        car: carSchema,

        // OAuth linkage (populated after a verified Firebase Google/Apple sign-in)
        googleId: { type: String, unique: true, sparse: true },
        appleId: { type: String, unique: true, sparse: true },

        phoneVerified: { type: Boolean, default: false },
        emailVerified: { type: Boolean, default: false },

        emergencyContact: emergencyContactSchema,
    },
    { timestamps: true }
)

driverSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

driverSchema.methods.comparePassword = function (candidate) {
    if (!this.password) return Promise.resolve(false)
    return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('Driver', driverSchema)
