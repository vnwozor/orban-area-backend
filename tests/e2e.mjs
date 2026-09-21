// ---------------------------------------------------------------------------
// End-to-end API test.  Start the server first (npm run dev), then:
//     npm test                       (uses http://localhost:5000)
//     API_URL=http://localhost:5055 npm test
// It creates its own throw-away accounts (names start with "e2e"), so it does
// not need the seed data.
// ---------------------------------------------------------------------------
const API = process.env.API_URL || 'http://localhost:5000'
let failed = 0
const check = (name, cond, extra = '') => {
    if (!cond) failed++
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`)
}

const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(API + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
}

const tag = Date.now().toString().slice(-7)
const tomorrow = new Date(Date.now() + 3600_000 + 86400_000).toISOString().slice(0, 10)
const wuse = { address: 'Wuse 2, Abuja', lat: 9.0765, lng: 7.4739 }
const gwarinpa = { address: 'Gwarinpa, Abuja', lat: 9.1113, lng: 7.4046 }
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const query = (extra = {}) =>
    '?' + new URLSearchParams({
        pickupLat: wuse.lat, pickupLng: wuse.lng, pickupAddress: wuse.address,
        destLat: gwarinpa.lat, destLng: gwarinpa.lng, destAddress: gwarinpa.address,
        date: tomorrow, time: '14:00', passengers: 2, ...extra,
    })
const card = { method: 'card', cardNumber: '4242 4242 4242 4242', exp: '12/30', cvv: '123' }

let counter = 0
const registerUser = async (name, email) =>
    (await call('POST', '/api/users', { body: { name, email, phone: `080${tag}${++counter}`, password: 'secret12' } })).data
const registerDriver = async (name, key, extra = {}) =>
    call('POST', '/api/drivers', { body: { name, email: `e2e-${key}-${tag}@test.com`, phone: `070${tag}${++counter}`, password: 'secret12', ...extra } })

// ---------------- accounts ----------------
const u1 = await registerUser('E2E Rider One', `e2e-r1-${tag}@test.com`)
const u2 = await registerUser('E2E Rider Two', `e2e-r2-${tag}@test.com`)
check('rider registers and gets a JWT', u1.token && u1.user?._id && !u1.user.password)
const dup = await call('POST', '/api/users', { body: { name: 'x', email: `e2e-r1-${tag}@test.com`, phone: '08000000000', password: 'secret12' } })
check('duplicate email is rejected', dup.status === 400)
const weak = await call('POST', '/api/users', { body: { name: 'x', email: `w${tag}@test.com`, phone: '08011111111', password: '123' } })
check('short password is rejected', weak.status === 400 && /6 characters/.test(weak.data.message), weak.data.message)
check('wrong password -> 401', (await call('POST', '/api/users/login', { body: { email: `e2e-r1-${tag}@test.com`, password: 'nope' } })).status === 401)
check('login is case-insensitive on email', (await call('POST', '/api/users/login', { body: { email: `E2E-R1-${tag}@TEST.com`, password: 'secret12' } })).status === 200)
const me = await call('GET', '/api/users/me', { token: u1.token })
check('GET /api/users/me', me.status === 200 && me.data.stats?.completedBookings === 0)
check('no token -> 401', (await call('GET', '/api/users/me')).status === 401)

const dA = await registerDriver('E2E Driver A', 'a', { photo: PIXEL, driverId: `DRV-${tag.slice(0, 5)}` })
check('driver registers with a Driver ID and photo', dA.status === 201 && dA.data.driver.driverId === `DRV-${tag.slice(0, 5)}` && dA.data.driver.photo)
check('driver cannot self-assign verification/rating', dA.data.driver.rating === 5 && dA.data.driver.verification.license === 'pending')
const dBad = await registerDriver('E2E Bad', 'bad', { photo: 'not-an-image' })
check('non-image photo is rejected', dBad.status === 400)
const dB = await registerDriver('E2E Driver B', 'b')
const loginByPhone = await call('POST', '/api/drivers/login', { body: { identifier: dA.data.driver.phone, password: 'secret12' } })
check('driver can log in with phone number', loginByPhone.status === 200 && loginByPhone.data.token)
const tokA = dA.data.token
const tokB = dB.data.token
check('driver token is rejected on rider routes', (await call('GET', '/api/bookings/mine', { token: tokA })).status === 403)
check('rider token is rejected on driver routes', (await call('GET', '/api/driver/requests', { token: u1.token })).status === 403)

// ---------------- vehicles ----------------
check('driver without a car is not listed', !(await call('GET', '/api/cars' + query())).data.cars.some((c) => c.id === dA.data.driver._id))
const badType = await call('PUT', '/api/driver/vehicle', { token: tokA, body: { model: 'X', plateNumber: 'ABC 1', type: 'Rocket', seats: 4 } })
check('invalid car type is rejected', badType.status === 400)
const vA = await call('PUT', '/api/driver/vehicle', { token: tokA, body: { model: 'Toyota Camry', year: 2019, plateNumber: 'e2e 111 aa', type: 'Sedan', seats: 4, color: '#3B4A66', photo: PIXEL } })
check('driver saves vehicle (plate upper-cased)', vA.status === 200 && vA.data.car.plateNumber === 'E2E 111 AA')
await call('PUT', '/api/driver/vehicle', { token: tokB, body: { model: 'Toyota Hiace', year: 2017, plateNumber: 'E2E 222 BB', type: 'Van', seats: 14 } })

// ---------------- search + details ----------------
const s2 = await call('GET', '/api/cars' + query())
const carA = s2.data.cars?.find((c) => c.id === dA.data.driver._id)
check('search lists the car with a fare', s2.status === 200 && carA?.available && carA.fare.total > 0, JSON.stringify(s2.data).slice(0, 200))
check('fare = base + distance + service', carA.fare.total === carA.fare.base + carA.fare.distance + carA.fare.service)
check('car has image, features and driver info', carA.image && carA.features.length && carA.driver.name === 'E2E Driver A')
const s6 = await call('GET', '/api/cars' + query({ passengers: 6 }))
check('6 passengers only shows cars with 6+ seats', s6.data.cars.every((c) => c.seats >= 6) && s6.data.cars.some((c) => c.type === 'Van'))
check('type filter works', (await call('GET', '/api/cars' + query({ type: 'Van' }))).data.cars.every((c) => c.type === 'Van'))
check('same pickup and destination -> 400', (await call('GET', '/api/cars' + query({ destLat: wuse.lat, destLng: wuse.lng }))).status === 400)
check('past date -> 400', (await call('GET', '/api/cars' + query({ date: '2020-01-01' }))).status === 400)
check('missing location -> 400', (await call('GET', '/api/cars?date=' + tomorrow + '&time=10:00')).status === 400)
const details = await call('GET', `/api/cars/${carA.id}` + query())
check('car details', details.status === 200 && details.data.car.plateNumber === 'E2E 111 AA' && details.data.car.fare.total === carA.fare.total)
await call('PATCH', '/api/driver/availability', { token: tokA, body: { online: false } })
const off = (await call('GET', '/api/cars' + query())).data.cars.find((c) => c.id === carA.id)
check('offline driver shows as unavailable', off.available === false && off.unavailableReason === 'Driver is offline')
const offBook = await call('POST', '/api/bookings', { token: u1.token, body: { carId: carA.id, pickup: wuse, destination: gwarinpa, date: tomorrow, time: '14:00', passengers: 2, payment: card } })
check('cannot book an offline driver', offBook.status === 409)
await call('PATCH', '/api/driver/availability', { token: tokA, body: { online: true } })

// ---------------- booking + payment ----------------
const book = (over = {}, token = u1.token) =>
    call('POST', '/api/bookings', { token, body: { carId: carA.id, pickup: wuse, destination: gwarinpa, date: tomorrow, time: '14:00', passengers: 2, expectedTotal: carA.fare.total, payment: card, ...over } })
check('bad card number -> 400', (await book({ payment: { ...card, cardNumber: '4242' } })).status === 400)
check('expired card -> 400', (await book({ payment: { ...card, exp: '01/20' } })).status === 400)
check('bad cvv -> 400', (await book({ payment: { ...card, cvv: '1' } })).status === 400)
check('price changed -> 409', (await book({ expectedTotal: 1 })).status === 409)
check('too many passengers -> 400', (await book({ passengers: 5 })).status === 400)
check('booking needs a rider token', (await book({}, null)).status === 401)
const b1 = await book()
check('booking created (pending, paid, code)', b1.status === 201 && b1.data.status === 'pending' && /^BK-\d{5,}/.test(b1.data.code) && b1.data.payment.status === 'paid')
check('card number / cvv are never returned', b1.data.payment.last4 === '4242' && !JSON.stringify(b1.data).includes('4242 4242') && !JSON.stringify(b1.data).includes('cvv'))
check('booking snapshots the car', b1.data.car.model === 'Toyota Camry' && b1.data.passenger.name === 'E2E Rider One' && b1.data.driver.name === 'E2E Driver A')
const cash = await book({ time: '20:00', payment: { method: 'cash' } })
check('cash booking = pay on pickup', cash.status === 201 && cash.data.payment.status === 'pay_on_pickup' && !cash.data.payment.reference)

// ---------------- driver side ----------------
const reqs = await call('GET', '/api/driver/requests', { token: tokA })
check('driver sees the requests', reqs.status === 200 && reqs.data.length === 2 && reqs.data[0].passenger.name === 'E2E Rider One')
const dn = await call('GET', '/api/notifications', { token: tokA })
check('driver got "New ride request" notifications', dn.data.unread === 2 && dn.data.items[0].title === 'New ride request')
const other = await call('PATCH', `/api/driver/bookings/${b1.data.id}/accept`, { token: tokB })
check('driver cannot touch another driver\'s booking', other.status === 404, JSON.stringify(other))
const acc = await call('PATCH', `/api/driver/bookings/${b1.data.id}/accept`, { token: tokA })
check('driver accepts', acc.status === 200 && acc.data.status === 'accepted')
check('cannot accept twice', (await call('PATCH', `/api/driver/bookings/${b1.data.id}/accept`, { token: tokA })).status === 400)
const un = await call('GET', '/api/notifications', { token: u1.token })
check('rider notified of acceptance', un.data.items.some((n) => n.title === 'Booking confirmed'))
const busy = (await call('GET', '/api/cars' + query({ time: '15:00' }))).data.cars.find((c) => c.id === carA.id)
check('accepted trip blocks the slot (+-2h)', busy.available === false && busy.unavailableReason === 'Booked for this time')
check('booking a blocked slot -> 409', (await book({ time: '15:00' }, u2.token)).status === 409)
check('a clear slot is still bookable', (await call('GET', '/api/cars' + query({ time: '20:00' }))).data.cars.find((c) => c.id === carA.id).available)
check('driver trips list', (await call('GET', '/api/driver/trips', { token: tokA })).data.length === 1)
check('cannot jump accepted -> completed', (await call('PATCH', `/api/driver/bookings/${b1.data.id}/status`, { token: tokA, body: { status: 'completed' } })).status === 400)
for (const s of ['arrived', 'started', 'completed']) {
    const r = await call('PATCH', `/api/driver/bookings/${b1.data.id}/status`, { token: tokA, body: { status: s } })
    check(`trip status -> ${s}`, r.status === 200 && r.data.status === s)
}
check('completed trip cannot change', (await call('PATCH', `/api/driver/bookings/${b1.data.id}/status`, { token: tokA, body: { status: 'arrived' } })).status === 400)
const earn = await call('GET', '/api/driver/earnings', { token: tokA })
check('earnings: today, week, count, 7 days', earn.data.today === b1.data.fare.total && earn.data.week === earn.data.today && earn.data.completedTrips === 1 && earn.data.days.length === 7, JSON.stringify(earn.data))
const hist = await call('GET', '/api/driver/history?tab=completed', { token: tokA })
check('history shows the completed trip with earnings', hist.data.length === 1 && hist.data[0].fare.total === b1.data.fare.total)
const pax = await call('GET', '/api/driver/passengers', { token: tokA })
check('previous passengers', pax.data.length === 1 && pax.data[0].name === 'E2E Rider One' && pax.data[0].trips === 1)
check('driver notified of payment', (await call('GET', '/api/notifications', { token: tokA })).data.items.some((n) => n.title === 'Payment received'))
check('rider notified trip completed', (await call('GET', '/api/notifications', { token: u1.token })).data.items.some((n) => n.title === 'Trip completed'))

// ---------------- rider bookings + cancel ----------------
const mine = await call('GET', '/api/bookings/mine', { token: u1.token })
check('My Bookings groups', mine.data.completed.length === 1 && mine.data.upcoming.length === 1 && mine.data.cancelled.length === 0)
check('rider can read own booking', (await call('GET', `/api/bookings/${b1.data.id}`, { token: u1.token })).status === 200)
check('assigned driver can read booking', (await call('GET', `/api/bookings/${b1.data.id}`, { token: tokA })).status === 200)
const peek = await call('GET', `/api/bookings/${b1.data.id}`, { token: u2.token })
check('another rider cannot read it', peek.status === 404, JSON.stringify(peek).slice(0, 200))
const cc = await call('PATCH', `/api/bookings/${b1.data.id}/cancel`, { token: u1.token })
check('completed booking cannot be cancelled', cc.status === 400, JSON.stringify(cc).slice(0, 200))
const canc = await call('PATCH', `/api/bookings/${cash.data.id}/cancel`, { token: u1.token })
check('rider cancels an upcoming booking', canc.status === 200 && canc.data.status === 'cancelled' && canc.data.cancelledBy === 'user')
check('driver notified of the cancellation', (await call('GET', '/api/notifications', { token: tokA })).data.items.some((n) => n.title === 'Trip cancelled'))

// decline flow
const b3 = await book({ time: '09:00', date: tomorrow }, u2.token)
const dec = await call('PATCH', `/api/driver/bookings/${b3.data.id}/decline`, { token: tokA })
check('driver declines a request (payment refunded)', dec.status === 200 && dec.data.status === 'declined' && dec.data.payment.status === 'refunded')
check('driver history: cancelled tab', (await call('GET', '/api/driver/history?tab=cancelled', { token: tokA })).data.length === 2)
check('declined shows under rider Cancelled', (await call('GET', '/api/bookings/mine', { token: u2.token })).data.cancelled.length === 1)

// ---------------- profile + notifications ----------------
const upd = await call('PATCH', `/api/users/${u1.user._id}/profile`, { token: u1.token, body: { name: 'E2E Rider Renamed' } })
check('rider edits profile', upd.status === 200 && upd.data.name === 'E2E Rider Renamed', JSON.stringify(upd).slice(0, 300))
const dm = await call('PUT', '/api/driver/me', { token: tokA, body: { name: 'E2E Driver Renamed' } })
check('driver edits profile', dm.status === 200 && dm.data.name === 'E2E Driver Renamed' && !dm.data.password)
const readAll = await call('PATCH', '/api/notifications/read-all', { token: tokA })
check('mark all notifications read', readAll.data.unread === 0 && (await call('GET', '/api/notifications/unread-count', { token: tokA })).data.unread === 0)
check('unknown API route -> JSON 404', (await call('GET', '/api/nope')).status === 404)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
