import Booking, { UPCOMING_STATUSES } from '../models/Booking.js'
import Driver from '../models/Driver.js'
import { asyncHandler, HttpError } from '../utils/http.js'
import { calculateFare } from '../utils/fare.js'
import { parseTrip, busyDriverIds } from '../utils/trip.js'
import { hasCar, serializeBooking } from '../utils/serialize.js'
import { processMockPayment } from '../utils/payment.js'
import { notify } from '../utils/notify.js'

const naira = (n) => `\u20A6${Number(n).toLocaleString('en-US')}`
const POPULATE_DRIVER = 'name phone rating driverId'
const POPULATE_USER = 'name phone'

const place = (loc) => (loc.address ? loc.address.split(',')[0] : 'pickup')

/**
 * POST /api/bookings   (rider, JWT)
 * {
 *   carId, date, time, passengers,
 *   pickup: { address, lat, lng }, destination: { address, lat, lng },
 *   expectedTotal,                      // the price the rider was shown
 *   payment: { method: 'card'|'bank'|'cash', cardNumber, exp, cvv }   // mock
 * }
 *
 * The fare is recomputed here. If it no longer matches expectedTotal we stop
 * and ask the rider to review it, so nobody pays a price they didn't see.
 */
export const createBooking = asyncHandler(async (req, res) => {
    const trip = parseTrip(req.body)

    const driver = await Driver.findById(req.body.carId)
    if (!driver || !hasCar(driver)) throw new HttpError(404, 'That car is no longer available')
    if (!driver.available) throw new HttpError(409, 'This driver has just gone offline. Please choose another car')
    if (driver.car.seats < trip.passengers) throw new HttpError(400, `This car seats ${driver.car.seats} passengers`)

    const busy = await busyDriverIds([driver._id], trip.scheduledAt)
    if (busy.has(String(driver._id))) throw new HttpError(409, 'This car has just been booked for that time. Please choose another')

    const fare = calculateFare(trip.pickup, trip.destination, driver.car)
    if (req.body.expectedTotal !== undefined && Number(req.body.expectedTotal) !== fare.total) {
        throw new HttpError(409, `The price is now ${naira(fare.total)}. Please review it and try again`)
    }

    const payment = processMockPayment(req.body.payment, fare.total)

    const booking = await Booking.create({
        code: await Booking.generateCode(),
        user: req.account._id,
        driver: driver._id,
        pickup: trip.pickup,
        destination: trip.destination,
        date: trip.date,
        time: trip.time,
        scheduledAt: trip.scheduledAt,
        passengers: trip.passengers,
        car: {
            model: driver.car.model,
            year: driver.car.year,
            type: driver.car.type,
            seats: driver.car.seats,
            plateNumber: driver.car.plateNumber,
            color: driver.car.color,
        },
        fare,
        payment,
        status: 'pending',
    })

    await notify({
        to: 'driver',
        id: driver._id,
        kind: 'request',
        title: 'New ride request',
        body: `${place(trip.pickup)} to ${place(trip.destination)}, ${trip.date} at ${trip.time}. Estimated fare ${naira(fare.total)}.`,
        booking: booking._id,
    })

    await booking.populate([{ path: 'driver', select: POPULATE_DRIVER }, { path: 'user', select: POPULATE_USER }])
    res.status(201).json(serializeBooking(booking))
})

/**
 * GET /api/bookings/mine   (rider, JWT)
 * Everything the rider has booked, grouped for the My Bookings tabs.
 */
export const getMyBookings = asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ user: req.account._id })
        .populate('driver', POPULATE_DRIVER)
        .populate('user', POPULATE_USER)
        .sort({ scheduledAt: -1 })

    const all = bookings.map(serializeBooking)
    res.json({
        upcoming: all.filter((b) => UPCOMING_STATUSES.includes(b.status)).reverse(), // soonest first
        completed: all.filter((b) => b.status === 'completed'),
        cancelled: all.filter((b) => b.status === 'cancelled' || b.status === 'declined'),
    })
})

/**
 * GET /api/bookings/:id   (the rider who booked it, or the assigned driver)
 */
export const getBooking = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate('driver', POPULATE_DRIVER)
        .populate('user', POPULATE_USER)
    if (!booking) throw new HttpError(404, 'Booking not found')

    const ownerId = String(req.role === 'driver' ? booking.driver?._id : booking.user?._id)
    if (ownerId !== String(req.account._id)) throw new HttpError(404, 'Booking not found')

    res.json(serializeBooking(booking))
})

/**
 * PATCH /api/bookings/:id/cancel   (rider, JWT)
 * Riders can cancel until the driver has arrived.
 */
export const cancelBooking = asyncHandler(async (req, res) => {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.account._id })
    if (!booking) throw new HttpError(404, 'Booking not found')
    if (!['pending', 'accepted'].includes(booking.status)) {
        throw new HttpError(400, 'This booking can no longer be cancelled')
    }

    booking.status = 'cancelled'
    booking.cancelledBy = 'user'
    booking.cancelledAt = new Date()
    if (booking.payment.status === 'paid') booking.payment.status = 'refunded' // mock refund
    await booking.save()

    await notify({
        to: 'driver',
        id: booking.driver,
        kind: 'cancel',
        title: 'Trip cancelled',
        body: `${req.account.name} cancelled ${place(booking.pickup)} to ${place(booking.destination)} (${booking.code}).`,
        booking: booking._id,
    })

    await booking.populate([{ path: 'driver', select: POPULATE_DRIVER }, { path: 'user', select: POPULATE_USER }])
    res.json(serializeBooking(booking))
})
