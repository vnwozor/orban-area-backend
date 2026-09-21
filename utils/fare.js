// ---------------------------------------------------------------------------
// Fare calculation - the ONE place prices are computed. The frontend never
// calculates a fare itself; it always displays what the API returns, and the
// booking endpoint recomputes the fare again so a client can't send its own.
//
//   total = base fare + (road distance in km x the car's price per km) + service fee
// ---------------------------------------------------------------------------

export const BASE_FARE = 1500 // naira
export const SERVICE_FEE = 500 // naira
export const ROAD_FACTOR = 1.3 // straight-line distance -> approximate road distance
export const MINUTES_PER_KM = 2.4 // ~25 km/h average city speed

// Default price per km for each car type (a driver can override it).
export const TYPE_RATES = { Compact: 400, Sedan: 500, SUV: 650, Van: 700 }
export const CAR_TYPES = Object.keys(TYPE_RATES)

const rad = (deg) => (deg * Math.PI) / 180

// Straight-line (haversine) distance between two { lat, lng } points, in km.
export const straightLineKm = (a, b) => {
    const R = 6371
    const dLat = rad(b.lat - a.lat)
    const dLng = rad(b.lng - a.lng)
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(h))
}

export const roadKm = (a, b) =>
    Math.max(1.5, Math.round(straightLineKm(a, b) * ROAD_FACTOR * 10) / 10)

// Old accounts have pricePerKm = 15 (from the first version of the app), which
// is far too low for a naira fare, so anything under 100 falls back to the
// default rate for the car's type.
export const rateForCar = (car) => {
    if (car?.pricePerKm >= 100) return car.pricePerKm
    return TYPE_RATES[car?.type] || 500
}

export const calculateFare = (pickup, destination, car) => {
    const km = roadKm(pickup, destination)
    const rate = rateForCar(car)
    const distance = Math.round((km * rate) / 50) * 50 // keep totals in neat N50 steps
    return {
        distanceKm: km,
        durationMin: Math.round(km * MINUTES_PER_KM),
        pricePerKm: rate,
        base: BASE_FARE,
        distance,
        service: SERVICE_FEE,
        total: BASE_FARE + distance + SERVICE_FEE,
    }
}
