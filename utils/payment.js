import { detectCardBrand } from './cardUtils.js'
import { HttpError } from './http.js'

// ---------------------------------------------------------------------------
// MOCK PAYMENT (school project). No processor is contacted and nothing is
// charged. We validate the shape of what the rider typed, keep only the brand
// and last 4 digits, and hand back a fake reference. To go live, replace this
// function with a real processor call (Paystack, Flutterwave, Stripe...) and
// keep the same return shape.
// ---------------------------------------------------------------------------

export const processMockPayment = (payment, amount) => {
    const method = payment?.method
    if (!['card', 'bank', 'cash'].includes(method)) {
        throw new HttpError(400, 'Choose a payment method: card, bank or cash')
    }

    if (method === 'cash') {
        return { method, status: 'pay_on_pickup', reference: null, brand: null, last4: null, amount, paidAt: null }
    }

    let brand = null
    let last4 = null
    if (method === 'card') {
        const digits = String(payment.cardNumber || '').replace(/\D/g, '')
        if (digits.length !== 16) throw new HttpError(400, 'Card number should have 16 digits')

        const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(payment.exp || ''))
        if (!m) throw new HttpError(400, 'Enter the card expiry as MM/YY')
        const expYear = 2000 + Number(m[2])
        const expMonth = Number(m[1])
        const now = new Date()
        if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
            throw new HttpError(400, 'This card has expired')
        }

        if (!/^\d{3,4}$/.test(String(payment.cvv || ''))) throw new HttpError(400, 'Enter the 3 or 4 digit CVV')

        brand = detectCardBrand(digits)
        last4 = digits.slice(-4)
    }

    const reference = `PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    return { method, status: 'paid', reference, brand, last4, amount, paidAt: new Date() }
}
