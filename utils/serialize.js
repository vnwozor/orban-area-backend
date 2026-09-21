import { rateForCar } from './fare.js'

// What the apps see. Keeping this in one place means the rider app and the
// driver app always get the same shape.

const DEFAULT_FEATURES = {
    Compact: ['Air conditioning', 'Phone charging'],
    Sedan: ['Air conditioning', 'Phone charging', 'Bottled water'],
    SUV: ['Air conditioning', 'Extra luggage space', 'Phone charging'],
    Van: ['Air conditioning', 'Large luggage area', 'Seats up to 14'],
}

export const featuresFor = (car) => DEFAULT_FEATURES[car?.type] || DEFAULT_FEATURES.Sedan

// A driver has a bookable car once they've saved a plate number.
export const hasCar = (driver) => Boolean(driver?.car?.plateNumber)

export const serializeCar = (driver, { fare = null, available = true, unavailableReason = null, tripsCompleted = 0 } = {}) => {
    const car = driver.car || {}
    return {
        id: String(driver._id),
        model: car.model || 'Car',
        year: car.year || null,
        type: car.type || 'Sedan',
        seats: car.seats || 4,
        color: car.color || '#3B4A66',
        plateNumber: car.plateNumber,
        image: car.photo || null,
        pricePerKm: rateForCar(car),
        features: featuresFor(car),
        available,
        unavailableReason,
        fare,
        driver: {
            id: String(driver._id),
            name: driver.name,
            rating: driver.rating ?? 5,
            tripsCompleted,
            photo: driver.photo || null,
            verified: Boolean(driver.isVerified),
            since: driver.createdAt ? new Date(driver.createdAt).getUTCFullYear() : null,
        },
    }
}

// user / driver arrive populated (name, phone, ...) - photos are left out on
// purpose so booking lists stay small.
export const serializeBooking = (b) => {
    const o = typeof b.toObject === 'function' ? b.toObject() : b
    const person = (p) =>
        p && p._id
            ? { id: String(p._id), name: p.name, phone: p.phone, ...(p.rating !== undefined ? { rating: p.rating } : {}), ...(p.driverId ? { driverId: p.driverId } : {}) }
            : p
                ? { id: String(p) }
                : null
    return {
        id: String(o._id),
        code: o.code,
        status: o.status,
        pickup: o.pickup,
        destination: o.destination,
        date: o.date,
        time: o.time,
        scheduledAt: o.scheduledAt,
        passengers: o.passengers,
        car: o.car,
        fare: o.fare,
        payment: o.payment,
        cancelledBy: o.cancelledBy,
        passenger: person(o.user),
        driver: person(o.driver),
        acceptedAt: o.acceptedAt || null,
        completedAt: o.completedAt || null,
        cancelledAt: o.cancelledAt || null,
        createdAt: o.createdAt,
    }
}

export const serializeNotification = (n) => ({
    id: String(n._id),
    kind: n.kind,
    title: n.title,
    body: n.body,
    read: n.read,
    booking: n.booking ? String(n.booking) : null,
    createdAt: n.createdAt,
})
