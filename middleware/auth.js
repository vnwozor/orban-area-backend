import { verifyToken } from '../config/jwt.js'
import User from '../models/User.js'
import Driver from '../models/Driver.js'

/**
 * requireAuth('user') or requireAuth('driver') - verifies the Bearer token,
 * loads the matching account, and attaches it as req.account. Also enforces
 * that the :id route param (when present) matches the token's owner, so one
 * account can't read/edit another's profile. Routes where :id is something
 * else (a booking id, say) pass { matchParamId: false } and check ownership
 * in the controller instead.
 */
export const requireAuth = (role, { matchParamId = true } = {}) => async (req, res, next) => {
    try {
        const header = req.headers.authorization || ''
        const token = header.startsWith('Bearer ') ? header.slice(7) : null
        if (!token) return res.status(401).json({ message: 'Missing or invalid Authorization header' })

        const payload = verifyToken(token)
        if (payload.role !== role) {
            return res.status(403).json({ message: 'Token is not valid for this resource' })
        }

        const Model = role === 'driver' ? Driver : User
        const account = await Model.findById(payload.id)
        if (!account) return res.status(401).json({ message: 'Account no longer exists' })

        if (matchParamId && req.params.id && req.params.id !== String(account._id)) {
            return res.status(403).json({ message: 'Not authorized to modify this account' })
        }

        req.account = account
        next()
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' })
    }
}

/**
 * requireAnyAuth - for endpoints shared by riders and drivers (notifications).
 * Verifies the Bearer token, loads whichever account it belongs to and sets
 * req.account plus req.role ('user' or 'driver').
 */
export const requireAnyAuth = async (req, res, next) => {
    try {
        const header = req.headers.authorization || ''
        const token = header.startsWith('Bearer ') ? header.slice(7) : null
        if (!token) return res.status(401).json({ message: 'Missing or invalid Authorization header' })

        const payload = verifyToken(token)
        if (payload.role !== 'user' && payload.role !== 'driver') {
            return res.status(403).json({ message: 'Token is not valid for this resource' })
        }

        const Model = payload.role === 'driver' ? Driver : User
        const account = await Model.findById(payload.id)
        if (!account) return res.status(401).json({ message: 'Account no longer exists' })

        req.account = account
        req.role = payload.role
        next()
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' })
    }
}
