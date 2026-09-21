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

const emergencyContactSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String, default: '' },
    },
    { _id: false }
)

const travelerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        phone: { type: String, default: '' },
        relationship: { type: String, default: '' },
    },
    { timestamps: true }
)

// Demo/tokenized payment method - the raw card number is NEVER stored, only
// a masked last4 + brand and a fake token standing in for a real processor
// token (e.g. a Stripe payment method id) once one is wired up.
const paymentMethodSchema = new mongoose.Schema(
    {
        token: { type: String, required: true },
        brand: { type: String, default: 'card' },
        last4: { type: String, required: true },
        expMonth: { type: Number, required: true },
        expYear: { type: Number, required: true },
        cardholderName: { type: String, default: '' },
        isDefault: { type: Boolean, default: false },
    },
    { timestamps: true }
)

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, unique: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: [6, 'Password must be at least 6 characters'], select: false },
        role: { type: String, default: 'user' },

        currentLocation: locationSchema,
        emergencyContact: emergencyContactSchema,
        savedTravelers: [travelerSchema],
        paymentMethods: [paymentMethodSchema],
    },
    { timestamps: true }
)

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('User', userSchema)
