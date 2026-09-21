import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import Otp from '../models/Otp.js'
import { sendSms, twilioEnabled } from '../config/twilio.js'

const CODE_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5

const hashCode = (code) => bcrypt.hash(code, 8)

/**
 * Generates a 6-digit code, stores its hash for `phone`+`role`, and sends it
 * by SMS. Returns { demo, code } - `code` is only populated when Twilio isn't
 * configured, so demo/local testing can proceed without a real SMS provider.
 */
export const requestOtp = async (phone, role) => {
    const code = crypto.randomInt(100000, 999999).toString()
    const codeHash = await hashCode(code)
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

    // Replace any previous outstanding code for this phone+role
    await Otp.findOneAndDelete({ phone, role })
    await Otp.create({ phone, role, codeHash, expiresAt })

    const { demo } = await sendSms(phone, `Your Orban verification code is ${code}`)

    if (demo) {
        console.log(`[otp] DEMO MODE - code for ${phone} (${role}): ${code}`)
    }

    return { demo: !twilioEnabled, code: !twilioEnabled ? code : undefined }
}

/**
 * Verifies a submitted code against the stored hash. Throws with a
 * user-facing message on any failure (wrong code, expired, too many tries).
 */
export const confirmOtp = async (phone, role, submittedCode) => {
    const record = await Otp.findOne({ phone, role })
    if (!record) {
        const err = new Error('No verification code was requested for this number')
        err.statusCode = 400
        throw err
    }

    if (record.attempts >= MAX_ATTEMPTS) {
        await record.deleteOne()
        const err = new Error('Too many incorrect attempts - request a new code')
        err.statusCode = 429
        throw err
    }

    const isMatch = await bcrypt.compare(submittedCode, record.codeHash)
    if (!isMatch) {
        record.attempts += 1
        await record.save()
        const err = new Error('Incorrect verification code')
        err.statusCode = 401
        throw err
    }

    await record.deleteOne()
    return true
}
