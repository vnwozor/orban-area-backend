import Booking, { LIVE_STATUSES } from '../models/Booking.js'
import { HttpError, cleanLocation } from './http.js'
import { straightLineKm } from './fare.js'
import { isValidDate, isValidTime, lagosToday, toScheduledAt } from './time.js'

// A driver can't take two trips within this window of each other.
export const SLOT_MINUTES = 120
const SLOT_MS = SLOT_MINUTES * 60 * 1000
export const MAX_PASSENGERS = 14

// Reads the trip from ?pickupLat=..&destLat=.. style query strings.
export const tripFromQuery = (q) => ({
    pickup: { lat: q.pickupLat, lng: q.pickupLng, address: q.pickupAddress },
    destination: { lat: q.destLat, lng: q.destLng, address: q.destAddress },
    date: q.date,
    time: q.time,
    passengers: q.passengers,
})

// Validates a trip (pickup, destination, date, time, passengers) and returns
// clean values. Throws HttpError(400) with a message a rider can act on.
export const parseTrip = (input) => {
    const pickup = cleanLocation(input.pickup, 'Pickup')
    const destination = cleanLocation(input.destination, 'Destination')
    if (straightLineKm(pickup, destination) < 0.1) {
        throw new HttpError(400, 'Pickup and destination must be different places')
    }

    if (!isValidDate(input.date)) throw new HttpError(400, 'Choose a valid date')
    if (!isValidTime(input.time)) throw new HttpError(400, 'Choose a valid time')
    if (input.date < lagosToday()) throw new HttpError(400, 'Choose today or a later date')
    const scheduledAt = toScheduledAt(input.date, input.time)
    if (scheduledAt.getTime() < Date.now() - 5 * 60 * 1000) {
        throw new HttpError(400, 'That time has already passed. Choose a later time')
    }

    const passengers = Number(input.passengers ?? 1)
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > MAX_PASSENGERS) {
        throw new HttpError(400, `Passengers must be between 1 and ${MAX_PASSENGERS}`)
    }

    return { pickup, destination, date: input.date, time: input.time, scheduledAt, passengers }
}

// Which of these drivers already have a confirmed trip around scheduledAt?
// Returns a Set of driver id strings.
export const busyDriverIds = async (driverIds, scheduledAt, excludeBookingId = null) => {
    if (!driverIds.length) return new Set()
    const filter = {
        driver: { $in: driverIds },
        status: { $in: LIVE_STATUSES },
        scheduledAt: { $gt: new Date(scheduledAt.getTime() - SLOT_MS), $lt: new Date(scheduledAt.getTime() + SLOT_MS) },
    }
    if (excludeBookingId) filter._id = { $ne: excludeBookingId }
    const clashes = await Booking.find(filter, 'driver')
    return new Set(clashes.map((b) => String(b.driver)))
}
