import admin from 'firebase-admin'
import fs from 'fs'

const { FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH } = process.env

let credential = null

try {
    if (FIREBASE_SERVICE_ACCOUNT_JSON) {
        credential = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)
    } else if (FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
        credential = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))
    }
} catch (err) {
    console.error('[oauth] Failed to parse Firebase service account credentials:', err.message)
}

export const firebaseEnabled = Boolean(credential)

if (firebaseEnabled && !admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(credential) })
} else if (!firebaseEnabled) {
    console.warn(
        '[oauth] Firebase service account is not configured - Google/Apple ' +
        'sign-in endpoints will respond with 501 until FIREBASE_SERVICE_ACCOUNT_JSON ' +
        '(or _PATH) is set in .env.'
    )
}

/**
 * Verifies a Firebase ID token minted client-side by Firebase Auth after a
 * Google or Apple sign-in. Throws if the token is invalid/expired.
 */
export const verifyFirebaseIdToken = async (idToken) => {
    if (!firebaseEnabled) {
        const err = new Error('OAuth sign-in is not configured on the server yet')
        err.statusCode = 501
        throw err
    }
    return admin.auth().verifyIdToken(idToken)
}

export default admin
