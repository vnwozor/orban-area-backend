// ---------------------------------------------------------------------------
// Demo data for the presentation:   npm run seed
//
// Creates a rider, 8 drivers with cars, and a realistic booking history so
// every screen has something to show. Safe to run again: it first removes the
// previous demo accounts (any account whose email ends in @example.com).
//
//   Rider  : chinwe@example.com / demo1234
//   Driver : emeka@example.com  / demo1234   (the busy one: earnings, requests, trips)
// ---------------------------------------------------------------------------
import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from './config/db.js'
import User from './models/User.js'
import Driver from './models/Driver.js'
import Booking from './models/Booking.js'
import Notification from './models/Notification.js'
import { calculateFare } from './utils/fare.js'
import { addDays, lagosToday, toScheduledAt } from './utils/time.js'

const PASSWORD = 'demo1234'

const PLACES = {
    'Wuse 2': { lat: 9.0765, lng: 7.4739 },
    Gwarinpa: { lat: 9.1113, lng: 7.4046 },
    Maitama: { lat: 9.087, lng: 7.4986 },
    'Jabi Lake Mall': { lat: 9.072, lng: 7.429 },
    Garki: { lat: 9.033, lng: 7.489 },
    Asokoro: { lat: 9.0396, lng: 7.529 },
    Utako: { lat: 9.0655, lng: 7.441 },
    'Central Business District': { lat: 9.0579, lng: 7.4951 },
    'Nnamdi Azikiwe Airport': { lat: 9.0068, lng: 7.2632 },
    Kubwa: { lat: 9.155, lng: 7.323 },
    Lugbe: { lat: 8.977, lng: 7.383 },
    'Life Camp': { lat: 9.093, lng: 7.42 },
}
const loc = (name) => ({ address: `${name}, Abuja`, ...PLACES[name] })

const DRIVERS = [
    { key: 'emeka', name: 'Emeka Obi', phone: '08035550164', email: 'emeka@example.com', rating: 4.9, car: { model: 'Toyota Camry', year: 2019, type: 'Sedan', seats: 4, color: '#3B4A66', plateNumber: 'ABJ 482 KD' } },
    { key: 'ada', name: 'Ada Nwosu', phone: '08035550201', email: 'ada@example.com', rating: 4.8, car: { model: 'Honda Accord', year: 2018, type: 'Sedan', seats: 4, color: '#AEB7C3', plateNumber: 'KTU 210 AA' } },
    { key: 'ibrahim', name: 'Ibrahim Musa', phone: '08035550202', email: 'ibrahim@example.com', rating: 4.7, car: { model: 'Toyota Corolla', year: 2020, type: 'Compact', seats: 4, color: '#E8ECF1', plateNumber: 'ABJ 915 FG' } },
    { key: 'tunde', name: 'Tunde Bakare', phone: '08035550203', email: 'tunde@example.com', rating: 4.9, car: { model: 'Toyota Highlander', year: 2019, type: 'SUV', seats: 6, color: '#1F2937', plateNumber: 'GWA 377 LK' } },
    { key: 'halima', name: 'Halima Sani', phone: '08035550204', email: 'halima@example.com', rating: 5.0, car: { model: 'Lexus RX 350', year: 2018, type: 'SUV', seats: 5, color: '#A5222F', plateNumber: 'ABJ 604 MN' } },
    { key: 'chukwudi', name: 'Chukwudi Eze', phone: '08035550205', email: 'chukwudi@example.com', rating: 4.6, car: { model: 'Toyota Hiace Bus', year: 2017, type: 'Van', seats: 14, color: '#EDF0F4', plateNumber: 'KUJ 118 RT' } },
    { key: 'blessing', name: 'Blessing Udo', phone: '08035550206', email: 'blessing@example.com', rating: 4.8, car: { model: 'Kia Rio', year: 2021, type: 'Compact', seats: 4, color: '#2F6FEB', plateNumber: 'ABJ 059 QS' } },
    { key: 'yakubu', name: 'Yakubu Danjuma', phone: '08035550207', email: 'yakubu@example.com', rating: 4.9, car: { model: 'Mercedes E-Class', year: 2017, type: 'Sedan', seats: 4, color: '#C9A24A', plateNumber: 'ABJ 001 VP', pricePerKm: 900 } },
]

const RIDERS = [
    { key: 'chinwe', name: 'Chinwe Okoro', phone: '08025550117', email: 'chinwe@example.com' },
    { key: 'ifeoma', name: 'Ifeoma Bello', phone: '08055550131', email: 'ifeoma@example.com' },
    { key: 'tobi', name: 'Tobi Adeyemi', phone: '08095550177', email: 'tobi@example.com' },
    { key: 'sadiq', name: 'Sadiq Lawal', phone: '08125550148', email: 'sadiq@example.com' },
    { key: 'ngozi', name: 'Ngozi Eze', phone: '08065550120', email: 'ngozi@example.com' },
    { key: 'zainab', name: 'Zainab Musa', phone: '08075550190', email: 'zainab@example.com' },
    { key: 'kelechi', name: 'Kelechi Amadi', phone: '08085550191', email: 'kelechi@example.com' },
]

const today = lagosToday()
const day = (offset) => addDays(today, offset)

const run = async () => {
    await connectDB()

    // --- clear the previous demo data ---
    const oldDrivers = await Driver.find({ email: /@example\.com$/ }, '_id')
    const oldUsers = await User.find({ email: /@example\.com$/ }, '_id')
    const ids = [...oldDrivers, ...oldUsers].map((d) => d._id)
    await Booking.deleteMany({ $or: [{ driver: { $in: oldDrivers.map((d) => d._id) } }, { user: { $in: oldUsers.map((u) => u._id) } }] })
    await Notification.deleteMany({ recipient: { $in: ids } })
    await Driver.deleteMany({ _id: { $in: oldDrivers.map((d) => d._id) } })
    await User.deleteMany({ _id: { $in: oldUsers.map((u) => u._id) } })

    // --- accounts (created one by one so passwords get hashed) ---
    const drivers = {}
    for (const d of DRIVERS) {
        drivers[d.key] = await Driver.create({
            name: d.name, phone: d.phone, email: d.email, password: PASSWORD, rating: d.rating, available: true,
            verification: { license: 'verified', vehicleRegistration: 'verified', identity: 'verified' },
            car: d.car,
        })
    }
    // Halima and Yakubu start "busy/offline" so the listing shows unavailable cars too
    drivers.halima.available = false
    await drivers.halima.save()

    const riders = {}
    for (const r of RIDERS) riders[r.key] = await User.create({ ...r, password: PASSWORD })

    // --- bookings ---
    const make = async ({ rider, driver, from, to, offset, time = '09:00', pax = 1, status, fare }) => {
        const d = drivers[driver]
        const date = day(offset)
        const f = calculateFare(loc(from), loc(to), d.car)
        if (fare) { f.total = fare; f.distance = fare - f.base - f.service }
        const done = status === 'completed'
        const cancelled = status === 'cancelled' || status === 'declined'
        return Booking.create({
            code: await Booking.generateCode(),
            user: riders[rider]._id, driver: d._id,
            pickup: loc(from), destination: loc(to),
            date, time, scheduledAt: toScheduledAt(date, time), passengers: pax,
            car: { model: d.car.model, year: d.car.year, type: d.car.type, seats: d.car.seats, plateNumber: d.car.plateNumber, color: d.car.color },
            fare: f,
            payment: { method: 'card', status: cancelled ? 'refunded' : 'paid', reference: `PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, brand: 'visa', last4: '4242', amount: f.total, paidAt: new Date() },
            status,
            cancelledBy: cancelled ? (status === 'declined' ? 'driver' : 'user') : null,
            acceptedAt: ['accepted', 'completed'].includes(status) ? new Date() : undefined,
            completedAt: done ? toScheduledAt(date, '12:00') : undefined,
            cancelledAt: cancelled ? new Date() : undefined,
        })
    }

    // Emeka: earnings today (35,000) and earlier this week
    await make({ rider: 'ngozi', driver: 'emeka', from: 'Garki', to: 'Wuse 2', offset: 0, time: '08:00', status: 'completed', fare: 12500 })
    await make({ rider: 'sadiq', driver: 'emeka', from: 'Utako', to: 'Maitama', offset: 0, time: '09:30', status: 'completed', fare: 9000 })
    await make({ rider: 'ifeoma', driver: 'emeka', from: 'Asokoro', to: 'Central Business District', offset: 0, time: '11:00', status: 'completed', fare: 13500 })
    await make({ rider: 'tobi', driver: 'emeka', from: 'Maitama', to: 'Nnamdi Azikiwe Airport', offset: -1, status: 'completed', fare: 24000 })
    await make({ rider: 'zainab', driver: 'emeka', from: 'Wuse 2', to: 'Gwarinpa', offset: -1, time: '15:00', status: 'completed', fare: 19500 })
    await make({ rider: 'kelechi', driver: 'emeka', from: 'Jabi Lake Mall', to: 'Kubwa', offset: -2, status: 'completed', fare: 31000 })
    await make({ rider: 'chinwe', driver: 'emeka', from: 'Lugbe', to: 'Wuse 2', offset: -4, time: '10:15', status: 'completed', fare: 13500 })
    await make({ rider: 'ngozi', driver: 'emeka', from: 'Kubwa', to: 'Central Business District', offset: -9, status: 'cancelled', fare: 16000 })
    // Emeka: requests waiting + accepted trips
    await make({ rider: 'ifeoma', driver: 'emeka', from: 'Wuse 2', to: 'Gwarinpa', offset: 5, time: '14:00', pax: 2, status: 'pending', fare: 8000 })
    await make({ rider: 'tobi', driver: 'emeka', from: 'Maitama', to: 'Nnamdi Azikiwe Airport', offset: 6, time: '06:15', status: 'pending', fare: 14500 })
    await make({ rider: 'sadiq', driver: 'emeka', from: 'Utako', to: 'Life Camp', offset: 2, time: '10:00', status: 'accepted', fare: 6000 })
    await make({ rider: 'ngozi', driver: 'emeka', from: 'Garki', to: 'Central Business District', offset: 3, time: '09:00', status: 'accepted', fare: 5500 })

    // Chinwe (the demo rider): upcoming, completed, cancelled with other drivers
    await make({ rider: 'chinwe', driver: 'tunde', from: 'Maitama', to: 'Nnamdi Azikiwe Airport', offset: 7, time: '08:30', pax: 3, status: 'accepted' })
    await make({ rider: 'chinwe', driver: 'ada', from: 'Wuse 2', to: 'Jabi Lake Mall', offset: 4, time: '18:00', pax: 2, status: 'accepted' })
    await make({ rider: 'chinwe', driver: 'ibrahim', from: 'Utako', to: 'Central Business District', offset: -11, time: '15:00', status: 'completed' })
    await make({ rider: 'chinwe', driver: 'blessing', from: 'Jabi Lake Mall', to: 'Gwarinpa', offset: -18, time: '12:30', pax: 2, status: 'completed' })
    await make({ rider: 'chinwe', driver: 'chukwudi', from: 'Kubwa', to: 'Lugbe', offset: -15, time: '07:00', pax: 8, status: 'cancelled' })

    // Notifications for the demo driver
    const req = await Booking.findOne({ driver: drivers.emeka._id, status: 'pending' }).sort({ scheduledAt: 1 })
    await Notification.create([
        { recipientType: 'driver', recipient: drivers.emeka._id, kind: 'request', title: 'New ride request', body: `Wuse 2 to Gwarinpa, ${day(5)} at 14:00. Estimated fare \u20A68,000.`, booking: req?._id, read: false },
        { recipientType: 'driver', recipient: drivers.emeka._id, kind: 'payment', title: 'Payment received', body: '\u20A613,500 for Asokoro to Central Business District.', read: false },
        { recipientType: 'driver', recipient: drivers.emeka._id, kind: 'cancel', title: 'Trip cancelled', body: 'Ngozi Eze cancelled Kubwa to Central Business District.', read: true },
        { recipientType: 'driver', recipient: drivers.emeka._id, kind: 'system', title: 'Documents verified', body: 'Your driver\u2019s licence and vehicle papers are verified.', read: true },
    ])

    console.log('Demo data ready.')
    console.log('  Rider : chinwe@example.com / demo1234')
    console.log('  Driver: emeka@example.com  / demo1234')
    await mongoose.disconnect()
}

run().catch(async (err) => {
    console.error(err)
    await mongoose.disconnect()
    process.exit(1)
})
