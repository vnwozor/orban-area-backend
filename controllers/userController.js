import User from '../models/User.js'
import Request from '../models/Request.js'

export const createUser = async (req, res) => {
    try {
        const user = await User.create(req.body)
        const { password, ...safeUser } = user.toObject()
        res.status(201).json(safeUser)
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

        const user = await User.findOne({ email }).select('+password')
        if (!user) return res.status(404).json({ message: 'No account with that email' })

        const isMatch = await user.comparePassword(password)
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' })

        const { password: _pw, ...safeUser } = user.toObject()
        res.json(safeUser)
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
