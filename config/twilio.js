import twilio from 'twilio'

const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    TWILIO_FROM_NUMBER,
} = process.env

// Prefer a Restricted/Standard API Key (SID starts with "SK") over the raw
// Auth Token when both are present - narrower scope if it ever leaks again.
const usingApiKey = Boolean(TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET)

export const twilioEnabled = Boolean(
    TWILIO_ACCOUNT_SID &&
    TWILIO_FROM_NUMBER &&
    (usingApiKey || TWILIO_AUTH_TOKEN)
)

let client = null
if (twilioEnabled && usingApiKey) {
    // API Key auth: (apiKeySid, apiKeySecret, { accountSid })
    client = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
        accountSid: TWILIO_ACCOUNT_SID,
    })
} else if (twilioEnabled) {
    // Fallback: plain Account SID + Auth Token
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
