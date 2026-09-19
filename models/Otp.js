import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema({
    phone: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'driver'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
})

// MongoDB TTL index: documents are automatically deleted once expiresAt passes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('Otp', otpSchema)
