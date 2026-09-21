// ---------------------------------------------------------------------------
// Nigeria is on WAT (UTC+1) all year with no daylight saving, so a fixed
// offset is enough. Booking dates/times are what the rider sees on their
// phone (Lagos time); we convert them to a real Date for comparisons.
// ---------------------------------------------------------------------------

const OFFSET_HOURS = 1
const OFFSET_MS = OFFSET_HOURS * 60 * 60 * 1000

// 'YYYY-MM-DD' for "today" in Lagos
export const lagosToday = (now = new Date()) =>
    new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10)

export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
export const isValidTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

// Booking date + time (Lagos) -> a real Date
export const toScheduledAt = (date, time) => new Date(`${date}T${time}:00+01:00`)

export const addDays = (dateStr, days) => {
    const d = new Date(`${dateStr}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

// Monday of the week that contains dateStr
export const weekStart = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00Z`)
    const daysSinceMonday = (d.getUTCDay() + 6) % 7
    return addDays(dateStr, -daysSinceMonday)
}

// Start of a Lagos day as a real Date
export const startOfDay = (dateStr) => new Date(`${dateStr}T00:00:00+01:00`)
