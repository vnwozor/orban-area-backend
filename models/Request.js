import mongoose from 'mongoose'

const locationSchema = new mongoose.Schema(
    {
        address: { type: String },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    { _id: false }
)

const requestSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
        pickupLocation: { type: locationSchema, required: true },
        dropoffLocation: { type: locationSchema, required: true },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'ongoing', 'completed', 'cancelled'],
            default: 'pending',
        },
        requestedAt: { type: Date, default: Date.now },
        fareEstimate: { type: Number, required: true },
        serviceType: { type: String, enum: ['ride', 'package'], required: true },
    },
    { timestamps: true }
)

export default mongoose.model('Request', requestSchema)
