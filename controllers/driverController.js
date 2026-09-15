import Driver from '../models/Driver.js'
import Request from '../models/Request.js'

export const createDriver = async (req, res) => {
    try {
        const driver = await Driver.create(req.body)
        const { password, ...safeDriver } = driver.toObject()
        res.status(201).json(safeDriver)
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

        const { password: _pw, ...safeDriver } = driver.toObject()
        res.json(safeDriver)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


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
