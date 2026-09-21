import Driver from '../models/Driver.js'
import Request from '../models/Request.js'
import { signToken } from '../config/jwt.js'
import { cleanImage } from '../utils/http.js'
import { cleanVehicle } from '../utils/vehicle.js'

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
        // Only these fields can be set at sign-up (never rating, verification, etc.)
        const { name, email, phone, password, photo, driverId, car, currentLocation } = req.body
        const data = { name, email, phone, password }
        if (photo) data.photo = cleanImage(photo)
        if (currentLocation) data.currentLocation = currentLocation
        if (car) data.car = cleanVehicle(car)

        // A suggested Driver ID is used if it's well-formed and free, otherwise the model makes one.
        if (driverId) {
            if (!/^DRV-\d{5,8}$/.test(driverId)) {
                return res.status(400).json({ message: 'Driver ID should look like DRV-12345' })
            }
            if (!(await Driver.exists({ driverId }))) data.driverId = driverId
        }

        const driver = await Driver.create(data)
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
        // Drivers can log in with their email OR their phone number.
        const identifier = String(req.body.identifier ?? req.body.email ?? '').trim()
        const { password } = req.body
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Email or phone number and password are required' })
        }

        const driver = await Driver.findOne({
            $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
        }).select('+password')
        if (!driver) return res.status(404).json({ message: 'No driver account with that email or phone number' })

        const isMatch = await driver.comparePassword(password)
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' })

        res.json(withToken(driver))
    } catch (err) {
        res.status(400).json({ message: err.message })
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
