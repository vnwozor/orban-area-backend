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
        name: { type: String, required: true },
        phone: { type: String, required: true, unique: true },
        email: {
            type: String,
            unique: true,
            sparse: true, // allows multiple docs with no email (phone-only OTP accounts)
        },
        // Not required: OTP-only and OAuth-only accounts have no password
        password: {
            type: String,
            select: false,
            required: function () {
                return !this.googleId && !this.appleId
            },
        },
        role: { type: String, default: 'user' },

        // OAuth linkage (populated after a verified Firebase Google/Apple sign-in)
        googleId: { type: String, unique: true, sparse: true },
        appleId: { type: String, unique: true, sparse: true },

        phoneVerified: { type: Boolean, default: false },
        emailVerified: { type: Boolean, default: false },

        currentLocation: locationSchema,
        emergencyContact: emergencyContactSchema,
        savedTravelers: [travelerSchema],
        paymentMethods: [paymentMethodSchema],
    },
    { timestamps: true }
)

userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.comparePassword = function (candidate) {
    if (!this.password) return Promise.resolve(false)
    return bcrypt.compare(candidate, this.password)
}

export default mongoose.model('User', userSchema)
