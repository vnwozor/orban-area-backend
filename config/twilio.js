import twilio from 'twilio'

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env

export const twilioEnabled = Boolean(
    TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER
)

let client = null
if (twilioEnabled) {
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
} else {
    console.warn(
        '[otp] Twilio credentials are not set - running in DEMO mode. ' +
        'OTP codes will be logged to the console and returned in the API ' +
        'response instead of being sent as a real SMS.'
    )
}

/**
 * Sends an SMS if Twilio is configured. In demo mode this is a no-op;
 * the caller is responsible for surfacing the code another way.
 */
export const sendSms = async (to, body) => {
    if (!twilioEnabled) return { demo: true }
    await client.messages.create({ to, from: TWILIO_FROM_NUMBER, body })
    return { demo: false }
}
