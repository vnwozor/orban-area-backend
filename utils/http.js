// Small helpers so controllers stay short.

export class HttpError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

// Wraps an async route handler so thrown errors reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message })
    if (err.name === 'ValidationError') {
        const first = Object.values(err.errors)[0]
        return res.status(400).json({ message: first?.message || err.message })
    }
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' })
    if (err.code === 11000) return res.status(400).json({ message: 'That value is already in use' })
    if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Image is too large' })
    console.error(err)
    res.status(500).json({ message: 'Something went wrong on the server' })
}

const MAX_IMAGE_CHARS = 700_000 // ~500 KB once base64-decoded. The apps downsize photos before uploading.

// Accepts a small image as a data URL (or null/'' to remove it).
export const cleanImage = (value) => {
    if (value === null || value === '') return null
    if (typeof value !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(value)) {
        throw new HttpError(400, 'Photo must be a PNG, JPG or WebP image')
    }
    if (value.length > MAX_IMAGE_CHARS) throw new HttpError(413, 'Photo is too large (max about 500 KB)')
    return value
}

export const cleanLocation = (loc, label) => {
    const lat = Number(loc?.lat)
    const lng = Number(loc?.lng)
    if (!loc || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new HttpError(400, `${label} location is missing or invalid`)
    }
    return { address: String(loc.address || '').slice(0, 300), lat, lng }
}
