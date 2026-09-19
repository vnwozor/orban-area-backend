import Driver from '../models/Driver.js'
import Request from '../models/Request.js'
import { signToken } from '../config/jwt.js'
import { requestOtp, confirmOtp } from '../services/otpService.js'
import { upsertAccountFromIdToken } from '../services/oauthService.js'

const toSafeDriver = (driverDoc) => {
    const { password, ...safeDriver } = driverDoc.toObject()
    return safeDriver
}

const withToken = (driverDoc) => ({
    driver: toSafeDriver(driverDoc),
    token: signToken({ id: driverDoc._id, role: 'driver' }),
})

// ---------------------------------------------------------------------------
// Email/password registration & login
// ---------------------------------------------------------------------------

export const createDriver = async (req, res) => {
    try {
        const driver = await Driver.create(req.body)
        res.status(201).json(withToken(driver))
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Email or phone already registered' })
        }
        res.status(400).json({ message: err.message })
    }
}

export const loginDriver = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' })
        }

        const driver = await Driver.findOne({ email }).select('+password')
        if (!driver) return res.status(404).json({ message: 'No driver account with that email' })

        const isMatch = await driver.comparePassword(password)
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' })

        res.json(withToken(driver))
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Phone number OTP sign up / login
// ---------------------------------------------------------------------------

export const sendDriverOtp = async (req, res) => {
    try {
        const { phone } = req.body
        if (!phone) return res.status(400).json({ message: 'Phone number is required' })

        const { demo, code } = await requestOtp(phone, 'driver')
        res.json({
            message: demo
                ? 'Twilio is not configured - here is the code for demo/testing purposes'
                : 'Verification code sent',
            demo,
            ...(demo ? { code } : {}),
        })
    } catch (err) {
        res.status(err.statusCode || 400).json({ message: err.message })
    }
}

export const verifyDriverOtp = async (req, res) => {
    try {
        const { phone, code, name, plateNumber } = req.body
        if (!phone || !code) {
            return res.status(400).json({ message: 'Phone number and code are required' })
        }

        await confirmOtp(phone, 'driver', code)

        let driver = await Driver.findOne({ phone })
        if (!driver) {
            driver = await Driver.create({
                name: name || 'New driver',
                phone,
                phoneVerified: true,
                car: { plateNumber: plateNumber || 'PENDING' },
            })
        } else if (!driver.phoneVerified) {
            driver.phoneVerified = true
            await driver.save()
        }

        res.json(withToken(driver))
    } catch (err) {
        res.status(err.statusCode || 400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Google / Apple sign-in (client uses Firebase Auth, sends us the ID token)
// ---------------------------------------------------------------------------

export const oauthLoginDriver = async (req, res) => {
    try {
        const { idToken } = req.body
        if (!idToken) return res.status(400).json({ message: 'idToken is required' })

        const { account } = await upsertAccountFromIdToken(Driver, idToken)
        res.json(withToken(account))
    } catch (err) {
        res.status(err.statusCode || 400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Basic reads / existing behaviour (unchanged)
// ---------------------------------------------------------------------------

export const getDrivers = async (req, res) => {
    try {
        const filter = {}
        if (req.query.available !== undefined) {
            filter.available = req.query.available === 'true'
        }
        const drivers = await Driver.find(filter)
        res.json(drivers)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const getDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id)
        if (!driver) return res.status(404).json({ message: 'Driver not found' })
        res.json(driver)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const updateDriverLocation = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { currentLocation: req.body.currentLocation },
            { new: true }
        )
        if (!driver) return res.status(404).json({ message: 'Driver not found' })
        res.json(driver)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const setDriverAvailability = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { available: req.body.available },
            { new: true }
        )
        if (!driver) return res.status(404).json({ message: 'Driver not found' })
        res.json(driver)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const getDriverStats = async (req, res) => {
    try {
        const completedRides = await Request.countDocuments({
            driverId: req.params.id,
            status: 'completed',
        })
        res.json({ completedRides })
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

// ---------------------------------------------------------------------------
// Profile management (protected - requireAuth('driver') ensures req.params.id
// matches the token holder)
// ---------------------------------------------------------------------------

export const updateDriverProfile = async (req, res) => {
    try {
        const { name, email, phone, car } = req.body
        const updates = {}
        if (name !== undefined) updates.name = name
        if (email !== undefined) updates.email = email
        if (phone !== undefined) updates.phone = phone
        if (car !== undefined) updates.car = car

        const driver = await Driver.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        })
        if (!driver) return res.status(404).json({ message: 'Driver not found' })
        res.json(driver)
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Email or phone already in use' })
        }
        res.status(400).json({ message: err.message })
    }
}

export const updateDriverEmergencyContact = async (req, res) => {
    try {
        const { name, phone, relationship } = req.body
        if (!name || !phone) {
            return res.status(400).json({ message: 'Emergency contact name and phone are required' })
        }

        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { emergencyContact: { name, phone, relationship } },
            { new: true, runValidators: true }
        )
        if (!driver) return res.status(404).json({ message: 'Driver not found' })
        res.json(driver)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}
