import crypto from 'crypto'
import User from '../models/User.js'
import Request from '../models/Request.js'
import Booking from '../models/Booking.js'
import { signToken } from '../config/jwt.js'
import { detectCardBrand } from '../utils/cardUtils.js'

const toSafeUser = (userDoc) => {
    const { password, ...safeUser } = userDoc.toObject()
    return safeUser
}

const withToken = (userDoc) => ({
    user: toSafeUser(userDoc),
    token: signToken({ id: userDoc._id, role: 'user' }),
})

// ---------------------------------------------------------------------------
// Email/password registration & login
// ---------------------------------------------------------------------------

export const createUser = async (req, res) => {
    try {
        // Only these fields can be set at sign-up (never role, etc.)
        const { name, email, phone, password } = req.body
        const user = await User.create({ name, email, phone, password })
        res.status(201).json(withToken(user))
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Email or phone already registered' })
        }
        res.status(400).json({ message: err.message })
    }
}

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' })
        }

        const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password')
        if (!user) return res.status(404).json({ message: 'No account with that email' })

        const isMatch = await user.comparePassword(password)
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' })

        res.json(withToken(user))
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Basic reads (unchanged behaviour)
// ---------------------------------------------------------------------------

// GET /api/users/me - the logged-in rider plus their booking counts
export const getMe = async (req, res) => {
    try {
        const [completed, upcoming] = await Promise.all([
            Booking.countDocuments({ user: req.account._id, status: 'completed' }),
            Booking.countDocuments({ user: req.account._id, status: { $in: ['pending', 'accepted', 'arrived', 'started'] } }),
        ])
        res.json({ ...toSafeUser(req.account), stats: { completedBookings: completed, upcomingBookings: upcoming } })
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })
        res.json(user)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const updateUserLocation = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { currentLocation: req.body.currentLocation },
            { new: true }
        )
        if (!user) return res.status(404).json({ message: 'User not found' })
        res.json(user)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const getUserStats = async (req, res) => {
    try {
        const completedRides = await Request.countDocuments({
            userId: req.params.id,
            status: 'completed',
        })
        res.json({ completedRides })
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Profile management (protected - requireAuth('user') ensures req.params.id
// matches the token holder)
// ---------------------------------------------------------------------------

export const updateUserProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body

        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })
        if (name !== undefined) user.name = name
        if (email !== undefined) user.email = email
        if (phone !== undefined) user.phone = phone
        await user.save() // runs the schema validators (email/phone format, required, unique)
        res.json(user)
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Email or phone already in use' })
        }
        res.status(400).json({ message: err.message })
    }
}

export const updateEmergencyContact = async (req, res) => {
    try {
        const { name, phone, relationship } = req.body
        if (!name || !phone) {
            return res.status(400).json({ message: 'Emergency contact name and phone are required' })
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { emergencyContact: { name, phone, relationship } },
            { new: true, runValidators: true }
        )
        if (!user) return res.status(404).json({ message: 'User not found' })
        res.json(user)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Saved travelers (e.g. family members booked for)
// ---------------------------------------------------------------------------

export const addTraveler = async (req, res) => {
    try {
        const { name, phone, relationship } = req.body
        if (!name) return res.status(400).json({ message: 'Traveler name is required' })

        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        user.savedTravelers.push({ name, phone, relationship })
        await user.save()
        res.status(201).json(user.savedTravelers)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const updateTraveler = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const traveler = user.savedTravelers.id(req.params.travelerId)
        if (!traveler) return res.status(404).json({ message: 'Traveler not found' })

        const { name, phone, relationship } = req.body
        if (name !== undefined) traveler.name = name
        if (phone !== undefined) traveler.phone = phone
        if (relationship !== undefined) traveler.relationship = relationship

        await user.save()
        res.json(user.savedTravelers)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const removeTraveler = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        user.savedTravelers = user.savedTravelers.filter(
            (t) => String(t._id) !== req.params.travelerId
        )
        await user.save()
        res.json(user.savedTravelers)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Payment wallet - DEMO ONLY. No real processor is integrated: raw card
// numbers are never stored, only a masked last4/brand + a fake token. Swap
// `token` generation for a real processor token (e.g. Stripe payment method
// id) before handling real payments.
// ---------------------------------------------------------------------------

export const addPaymentMethod = async (req, res) => {
    try {
        const { cardNumber, expMonth, expYear, cardholderName } = req.body
        const digitsOnly = String(cardNumber || '').replace(/\D/g, '')

        if (digitsOnly.length < 12) {
            return res.status(400).json({ message: 'Enter a valid card number' })
        }
        if (!expMonth || !expYear) {
            return res.status(400).json({ message: 'Expiry month and year are required' })
        }

        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const isFirstCard = user.paymentMethods.length === 0
        user.paymentMethods.push({
            token: `demo_tok_${crypto.randomBytes(12).toString('hex')}`,
            brand: detectCardBrand(digitsOnly),
            last4: digitsOnly.slice(-4),
            expMonth,
            expYear,
            cardholderName,
            isDefault: isFirstCard,
        })

        await user.save()
        res.status(201).json(user.paymentMethods)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const removePaymentMethod = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const wasDefault = user.paymentMethods.id(req.params.methodId)?.isDefault
        user.paymentMethods = user.paymentMethods.filter(
            (m) => String(m._id) !== req.params.methodId
        )
        if (wasDefault && user.paymentMethods.length > 0) {
            user.paymentMethods[0].isDefault = true
        }

        await user.save()
        res.json(user.paymentMethods)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const setDefaultPaymentMethod = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        let found = false
        user.paymentMethods.forEach((m) => {
            const isMatch = String(m._id) === req.params.methodId
            m.isDefault = isMatch
            if (isMatch) found = true
        })
        if (!found) return res.status(404).json({ message: 'Payment method not found' })

        await user.save()
        res.json(user.paymentMethods)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}
