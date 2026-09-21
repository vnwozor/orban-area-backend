import Driver from '../models/Driver.js'
import Booking from '../models/Booking.js'
import { asyncHandler, HttpError } from '../utils/http.js'
import { calculateFare, CAR_TYPES } from '../utils/fare.js'
import { serializeCar, hasCar } from '../utils/serialize.js'
import { parseTrip, tripFromQuery, busyDriverIds } from '../utils/trip.js'

// Completed-trip counts for a list of drivers, in one query.
const completedCounts = async (driverIds) => {
    if (!driverIds.length) return new Map()
    const rows = await Booking.aggregate([
        { $match: { status: 'completed', driver: { $in: driverIds } } },
        { $group: { _id: '$driver', n: { $sum: 1 } } },
    ])
    return new Map(rows.map((r) => [String(r._id), r.n]))
}

// Works out availability + fare for each driver's car for one trip.
const presentCars = async (drivers, trip) => {
    const ids = drivers.map((d) => d._id)
    const [busy, counts] = await Promise.all([busyDriverIds(ids, trip.scheduledAt), completedCounts(ids)])

    return drivers.map((d) => {
        let available = true
        let unavailableReason = null
        if (!d.available) {
            available = false
            unavailableReason = 'Driver is offline'
        } else if (busy.has(String(d._id))) {
            available = false
            unavailableReason = 'Booked for this time'
        }
        return serializeCar(d, {
            fare: calculateFare(trip.pickup, trip.destination, d.car),
            available,
            unavailableReason,
            tripsCompleted: counts.get(String(d._id)) || 0,
        })
    })
}

/**
 * GET /api/cars?pickupLat=&pickupLng=&pickupAddress=&destLat=&destLng=&destAddress=
 *              &date=YYYY-MM-DD&time=HH:mm&passengers=2&type=SUV
 *
 * "Search available cars": every car that seats the group, with the fare for
 * this exact trip. Cars that can't take the booking (driver offline, already
 * booked at that time) are still returned with available=false so the rider
 * can see why, and they sort to the bottom.
 */
export const searchCars = asyncHandler(async (req, res) => {
    const trip = parseTrip(tripFromQuery(req.query))

    const type = req.query.type
    if (type && type !== 'All' && !CAR_TYPES.includes(type)) {
        throw new HttpError(400, `Car type must be one of: ${CAR_TYPES.join(', ')}`)
    }

    const drivers = (await Driver.find({ 'car.plateNumber': { $exists: true } })).filter(
        (d) => hasCar(d) && d.car.seats >= trip.passengers && (!type || type === 'All' || d.car.type === type)
    )

    const cars = await presentCars(drivers, trip)
    cars.sort((a, b) => Number(b.available) - Number(a.available) || b.driver.rating - a.driver.rating)

    res.json({
        trip: { pickup: trip.pickup, destination: trip.destination, date: trip.date, time: trip.time, passengers: trip.passengers },
        cars,
    })
})

/**
 * GET /api/cars/:id  (+ the same trip query params as the search)
 * Car details page: bigger car info, driver info, and the fare for the trip.
 */
export const getCar = asyncHandler(async (req, res) => {
    const driver = await Driver.findById(req.params.id)
    if (!driver || !hasCar(driver)) throw new HttpError(404, 'Car not found')

    const trip = parseTrip(tripFromQuery(req.query))
    const [car] = await presentCars([driver], trip)
    res.json({ trip: { pickup: trip.pickup, destination: trip.destination, date: trip.date, time: trip.time, passengers: trip.passengers }, car })
})
