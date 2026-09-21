import { verifyFirebaseIdToken } from '../config/firebase.js'

/**
 * Verifies the Firebase ID token the client got from signInWithPopup/
 * signInWithApple, and finds-or-creates the matching account in `Model`
 * (User or Driver). Returns { account, created }.
 */
export const upsertAccountFromIdToken = async (Model, idToken) => {
    const decoded = await verifyFirebaseIdToken(idToken)
    const provider = decoded.firebase?.sign_in_provider || ''
    const isApple = provider.includes('apple')
    const providerField = isApple ? 'appleId' : 'googleId'

    let account = await Model.findOne({ [providerField]: decoded.uid })

    if (!account && decoded.email) {
        account = await Model.findOne({ email: decoded.email })
    }

    if (account) {
        if (!account[providerField]) account[providerField] = decoded.uid
        if (decoded.email && !account.email) account.email = decoded.email
        if (decoded.email_verified) account.emailVerified = true
        await account.save()
        return { account, created: false }
    }

    if (!decoded.email && !decoded.phone_number) {
        const err = new Error('This sign-in method did not share an email or phone number to create an account with')
        err.statusCode = 400
        throw err
    }

    account = await Model.create({
        name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'New user'),
        email: decoded.email || undefined,
        phone: decoded.phone_number || `pending-${decoded.uid}`,
        emailVerified: Boolean(decoded.email_verified),
        [providerField]: decoded.uid,
    })

    return { account, created: true }
}

const BRAND_PATTERNS = [
    { brand: 'visa', pattern: /^4/ },
    { brand: 'mastercard', pattern: /^(5[1-5]|2[2-7])/ },
    { brand: 'amex', pattern: /^3[47]/ },
    { brand: 'discover', pattern: /^6(?:011|5)/ },
]

export const detectCardBrand = (digitsOnly) => {
    const match = BRAND_PATTERNS.find(({ pattern }) => pattern.test(digitsOnly))
    return match ? match.brand : 'card'
}
