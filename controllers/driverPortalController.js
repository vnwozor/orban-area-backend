import Booking, { LIVE_STATUSES } from '../models/Booking.js'
import Driver from '../models/Driver.js'
import { asyncHandler, HttpError, cleanImage } from '../utils/http.js'
import { cleanVehicle } from '../utils/vehicle.js'
import { busyDriverIds } from '../utils/trip.js'
import { serializeBooking } from '../utils/serialize.js'
import { notify } from '../utils/notify.js'
import { addDays, lagosToday, startOfDay, weekStart } from '../utils/time.js'

// Everything here is "the logged-in driver" - identity comes from the JWT,
// never from an id in the URL, so a driver can only ever touch their own data.

const naira = (n) => `\u20A6${Number(n).toLocaleString('en-US')}`
const POPULATE_USER = 'name phone'
const mine = (req) => ({ driver: req.account._id })
const place = (loc) => (loc.address ? loc.address.split(',')[0] : 'pickup')
const label = (b) => `${place(b.pickup)} to ${place(b.destination)}`

const safeDriver = (d) => {
    const o = d.toObject()
    delete o.password
    return o
}

// ---------------------------------------------------------------------------
// Profile, vehicle, availability
// ---------------------------------------------------------------------------

export const getMe = asyncHandler(async (req, res) => {
    const completedTrips = await Booking.countDocuments({ ...mine(req), status: 'completed' })
    res.json({ ...safeDriver(req.account), stats: { completedTrips } })
})

// PUT /api/driver/me  { name, phone, email, photo }
export const updateMe = asyncHandler(async (req, res) => {
    const { name, phone, email, photo } = req.body
    const d = req.account
    if (name !== undefined) {
        if (!String(name).trim()) throw new HttpError(400, 'Name is required')
        d.name = name
    }
    if (phone !== undefined) d.phone = phone
    if (email !== undefined) d.email = email
    if (photo !== undefined) d.photo = cleanImage(photo)
    await d.save()
    res.json(safeDriver(d))
})

// PUT /api/driver/vehicle  { model, year, plateNumber, type, seats, color, photo }
export const updateVehicle = asyncHandler(async (req, res) => {
    const d = req.account
    d.car = cleanVehicle(req.body, d.car ? d.car.toObject() : {})
    await d.save()
    res.json(safeDriver(d))
})

// PATCH /api/driver/availability  { online: true|false }
export const setAvailability = asyncHandler(async (req, res) => {
    if (typeof req.body.online !== 'boolean') throw new HttpError(400, '"online" must be true or false')
    req.account.available = req.body.online
    await req.account.save()
    res.json({ online: req.account.available })
})

// ---------------------------------------------------------------------------
// Requests, upcoming trips, history
// ---------------------------------------------------------------------------

// GET /api/driver/requests - new ride requests waiting for Accept / Decline
export const getRequests = asyncHandler(async (req, res) => {
    const list = await Booking.find({ ...mine(req), status: 'pending' }).populate('user', POPULATE_USER).sort({ scheduledAt: 1 })
    res.json(list.map(serializeBooking))
})

// GET /api/driver/trips - accepted trips that haven't finished yet
export const getTrips = asyncHandler(async (req, res) => {
    const list = await Booking.find({ ...mine(req), status: { $in: LIVE_STATUSES } }).populate('user', POPULATE_USER).sort({ scheduledAt: 1 })
    res.json(list.map(serializeBooking))
})

// GET /api/driver/history?tab=completed|cancelled
export const getHistory = asyncHandler(async (req, res) => {
    const tab = req.query.tab === 'cancelled' ? 'cancelled' : 'completed'
    const statuses = tab === 'cancelled' ? ['cancelled', 'declined'] : ['completed']
    const list = await Booking.find({ ...mine(req), status: { $in: statuses } })
        .populate('user', POPULATE_USER)
        .sort({ scheduledAt: -1 })
        .limit(100)
    res.json(list.map(serializeBooking))
})

// GET /api/driver/passengers - people this driver has driven, with trip counts
export const getPassengers = asyncHandler(async (req, res) => {
    const done = await Booking.find({ ...mine(req), status: 'completed' }).populate('user', POPULATE_USER).sort({ completedAt: -1 }).limit(500)
    const byUser = new Map()
    for (const b of done) {
        const id = String(b.user?._id || b.user)
        const row = byUser.get(id) || { id, name: b.user?.name || 'Passenger', phone: b.user?.phone || '', trips: 0, totalSpent: 0, lastTrip: null }
        row.trips += 1
        row.totalSpent += b.fare.total
        if (!row.lastTrip || b.completedAt > row.lastTrip) row.lastTrip = b.completedAt
        byUser.set(id, row)
    }
    res.json([...byUser.values()].sort((a, b) => new Date(b.lastTrip) - new Date(a.lastTrip)))
})

// GET /api/driver/earnings - today, this week (Mon-Sun), completed trips and a per-day breakdown
export const getEarnings = asyncHandler(async (req, res) => {
    const today = lagosToday()
    const monday = weekStart(today)

    const [done, completedTrips] = await Promise.all([
        Booking.find({ ...mine(req), status: 'completed', completedAt: { $gte: startOfDay(monday) } }, 'fare completedAt'),
        Booking.countDocuments({ ...mine(req), status: 'completed' }),
    ])

    const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays(monday, i), total: 0 }))
    for (const b of done) {
        const day = days.find((d) => d.date === lagosToday(b.completedAt))
        if (day) day.total += b.fare.total
    }

    res.json({
        today: days.find((d) => d.date === today)?.total || 0,
        week: days.reduce((sum, d) => sum + d.total, 0),
        completedTrips,
        todayDate: today,
        days,
    })
})

// ---------------------------------------------------------------------------
// Trip actions
// ---------------------------------------------------------------------------

const loadMyBooking = async (req) => {
    const booking = await Booking.findOne({ _id: req.params.id, ...mine(req) })
    if (!booking) throw new HttpError(404, 'Booking not found')
    return booking
}

const respond = async (res, booking) => {
    await booking.populate('user', POPULATE_USER)
    res.json(serializeBooking(booking))
}

// PATCH /api/driver/bookings/:id/accept
export const acceptBooking = asyncHandler(async (req, res) => {
    const booking = await loadMyBooking(req)
    if (booking.status !== 'pending') throw new HttpError(400, 'This request has already been answered')

    const busy = await busyDriverIds([booking.driver], booking.scheduledAt, booking._id)
    if (busy.size) throw new HttpError(409, 'You already have a trip around that time')

    booking.status = 'accepted'
    booking.acceptedAt = new Date()
    await booking.save()

    await notify({
        to: 'user',
        id: booking.user,
        kind: 'status',
        title: 'Booking confirmed',
        body: `${req.account.name} accepted your trip (${booking.code}).`,
        booking: booking._id,
    })
    await respond(res, booking)
})

// PATCH /api/driver/bookings/:id/decline
export const declineBooking = asyncHandler(async (req, res) => {
    const booking = await loadMyBooking(req)
    if (booking.status !== 'pending') throw new HttpError(400, 'This request has already been answered')

    booking.status = 'declined'
    booking.cancelledBy = 'driver'
    booking.cancelledAt = new Date()
    if (booking.payment.status === 'paid') booking.payment.status = 'refunded' // mock refund
    await booking.save()

    await notify({
        to: 'user',
        id: booking.user,
        kind: 'cancel',
        title: 'Booking declined',
        body: `${req.account.name} could not take your trip (${booking.code}). Your payment is refunded.`,
        booking: booking._id,
    })
    await respond(res, booking)
})

// accepted -> arrived -> started -> completed, or cancelled from any live step
const TRANSITIONS = {
    accepted: ['arrived', 'cancelled'],
    arrived: ['started', 'cancelled'],
    started: ['completed', 'cancelled'],
}

const STATUS_MESSAGES = {
    arrived: (b) => ({ title: 'Your driver has arrived', body: `${b.car.model} (${b.car.plateNumber}) is at the pickup point.` }),
    started: () => ({ title: 'Your trip has started', body: 'Have a safe ride.' }),
    completed: (b) => ({ title: 'Trip completed', body: `Thanks for riding with us. Total ${naira(b.fare.total)}.` }),
    cancelled: (b) => ({ title: 'Trip cancelled by driver', body: `Your driver cancelled ${b.code}. Your payment is refunded.` }),
}

// PATCH /api/driver/bookings/:id/status  { status: 'arrived' | 'started' | 'completed' | 'cancelled' }
export const updateTripStatus = asyncHandler(async (req, res) => {
    const booking = await loadMyBooking(req)
    const next = req.body.status
    const allowed = TRANSITIONS[booking.status] || []
    if (!allowed.includes(next)) {
        throw new HttpError(400, `A trip that is "${booking.status}" can only move to: ${allowed.join(', ') || 'nothing (it is finished)'}`)
    }

    booking.status = next
    if (next === 'completed') booking.completedAt = new Date()
    if (next === 'cancelled') {
        booking.cancelledBy = 'driver'
        booking.cancelledAt = new Date()
        if (booking.payment.status === 'paid') booking.payment.status = 'refunded' // mock refund
    }
    await booking.save()

    const msg = STATUS_MESSAGES[next](booking)
    await notify({ to: 'user', id: booking.user, kind: next === 'cancelled' ? 'cancel' : 'status', ...msg, booking: booking._id })

    if (next === 'completed') {
        await notify({
            to: 'driver',
            id: booking.driver,
            kind: 'payment',
            title: booking.payment.status === 'pay_on_pickup' ? 'Trip completed' : 'Payment received',
            body: `${naira(booking.fare.total)} for ${label(booking)}.`,
            booking: booking._id,
        })
    }
    await respond(res, booking)
})
