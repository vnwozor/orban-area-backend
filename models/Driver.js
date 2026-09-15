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

const driverSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true, select: false },
        role: { type: String, default: 'driver' },
        rating: { type: Number, default: 5 },
        available: { type: Boolean, default: true },
        currentLocation: locationSchema,
        car: carSchema,
    },
    { timestamps: true }
)

driverSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

driverSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('Driver', driverSchema)
