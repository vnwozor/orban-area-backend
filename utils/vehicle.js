import { CAR_TYPES } from './fare.js'
import { HttpError, cleanImage } from './http.js'

// Validates the vehicle fields a driver can send (registration + Vehicle page).
// `existing` lets a partial update keep the fields that weren't sent.
export const cleanVehicle = (input = {}, existing = {}) => {
    const has = (k) => input[k] !== undefined

    const model = String(has('model') ? input.model : existing.model || '').trim()
    if (!model) throw new HttpError(400, 'Car model is required')

    const plateNumber = String(has('plateNumber') ? input.plateNumber : existing.plateNumber || '').trim().toUpperCase()
    if (!plateNumber) throw new HttpError(400, 'Plate number is required')

    const type = has('type') ? input.type : existing.type || 'Sedan'
    if (!CAR_TYPES.includes(type)) throw new HttpError(400, `Car type must be one of: ${CAR_TYPES.join(', ')}`)

    const seats = Number(has('seats') ? input.seats : existing.seats ?? 4)
    if (!Number.isInteger(seats) || seats < 1 || seats > 14) throw new HttpError(400, 'Seats must be between 1 and 14')

    let year = has('year') ? input.year : existing.year ?? null
    if (year === '' || year === null) year = null
    else {
        year = Number(year)
        if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 1) {
            throw new HttpError(400, 'Enter a valid car year')
        }
    }

    const color = has('color') ? input.color : existing.color || '#3B4A66'
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new HttpError(400, 'Colour must be a hex value like #3B4A66')

    let pricePerKm = has('pricePerKm') ? input.pricePerKm : existing.pricePerKm ?? null
    if (pricePerKm === '' || pricePerKm === null) pricePerKm = null
    else {
        pricePerKm = Number(pricePerKm)
        if (!Number.isFinite(pricePerKm) || pricePerKm < 100 || pricePerKm > 5000) {
            throw new HttpError(400, 'Price per km must be between 100 and 5000')
        }
    }

    const photo = has('photo') ? cleanImage(input.photo) : existing.photo ?? null

    return { model, plateNumber, type, seats, year, color, pricePerKm, photo }
}
