import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me'
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d'

if (!process.env.JWT_SECRET) {
    console.warn(
        '[auth] JWT_SECRET is not set in .env - using an insecure default. ' +
        'Set JWT_SECRET before deploying anywhere real.'
    )
}

/**
 * Issue a signed token for either a user or a driver account.
 * `role` is embedded so the auth middleware knows which collection to check.
 */
export const signToken = ({ id, role }) => {
    return jwt.sign({ id, role }, SECRET, { expiresIn: EXPIRES_IN })
}

export const verifyToken = (token) => {
    return jwt.verify(token, SECRET)
}
