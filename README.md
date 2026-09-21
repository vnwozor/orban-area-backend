# Orban backend (Express + MongoDB)

Your original backend with the booking system added. Nothing was removed: the old
`/api/requests`, `/api/users` and `/api/drivers` routes still work.

## Run it

```bash
npm install
cp .env.example .env      # then edit MONGO_URI and JWT_SECRET
npm run seed              # optional: demo rider, 8 drivers and booking history
npm run dev
npm test                  # optional: API end-to-end test (server must be running)
```

Demo logins after `npm run seed`:

| App    | Login                  | Password   |
| ------ | ---------------------- | ---------- |
| Rider  | chinwe@example.com     | demo1234   |
| Driver | emeka@example.com      | demo1234   |

## How it works

- A **car** is a driver's vehicle. The car id is the driver's id (one car per driver).
- A rider searches by route, date, time and passengers. The API returns every car that seats
  the group with the **fare for that trip** (`utils/fare.js`), and marks cars as unavailable if
  the driver is offline or already has a confirmed trip within 2 hours of that time.
- Booking flow: `pending` -> driver accepts -> `accepted` -> `arrived` -> `started` -> `completed`.
  A rider can cancel while it is `pending` or `accepted`. A driver can decline a request, or cancel a live trip.
- The fare is **recomputed on the server** when a booking is made. The rider's app sends the price it showed
  (`expectedTotal`); if it differs the API answers 409 instead of charging a different amount.
- Payment is a **mock** (`utils/payment.js`). Card numbers and CVVs are validated and thrown away; only the
  brand and last 4 digits are kept.

## API

Rider routes need `Authorization: Bearer <token>` from `POST /api/users` or `/api/users/login`.
Driver routes need the token from `POST /api/drivers` or `/api/drivers/login`.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| POST | `/api/users` | public | Register `{ name, email, phone, password }` -> `{ user, token }` |
| POST | `/api/users/login` | public | `{ email, password }` |
| GET | `/api/users/me` | rider | Profile + booking counts |
| PATCH | `/api/users/:id/profile` | rider | Edit name / email / phone |
| GET | `/api/cars?pickupLat&pickupLng&pickupAddress&destLat&destLng&destAddress&date&time&passengers&type` | public | Search available cars with fares |
| GET | `/api/cars/:id` + same query | public | Car details, driver info and fare |
| POST | `/api/bookings` | rider | Book + pay (mock). Body: `carId, pickup, destination, date, time, passengers, expectedTotal, payment` |
| GET | `/api/bookings/mine` | rider | `{ upcoming, completed, cancelled }` |
| GET | `/api/bookings/:id` | rider or driver | One booking (ticket) |
| PATCH | `/api/bookings/:id/cancel` | rider | Cancel |
| POST | `/api/drivers` | public | Register `{ name, email, phone, password, photo?, driverId?, car? }` -> `{ driver, token }` |
| POST | `/api/drivers/login` | public | `{ identifier (email or phone), password }` |
| GET / PUT | `/api/driver/me` | driver | Profile (+ stats) / edit `{ name, phone, email, photo }` |
| PUT | `/api/driver/vehicle` | driver | `{ model, year, plateNumber, type, seats, color, photo }` |
| PATCH | `/api/driver/availability` | driver | `{ online: true/false }` |
| GET | `/api/driver/requests` | driver | New ride requests |
| GET | `/api/driver/trips` | driver | Upcoming (accepted) trips |
| GET | `/api/driver/history?tab=completed\|cancelled` | driver | Trip history |
| GET | `/api/driver/passengers` | driver | Previous passengers |
| GET | `/api/driver/earnings` | driver | `{ today, week, completedTrips, days[] }` |
| PATCH | `/api/driver/bookings/:id/accept` | driver | Accept a request |
| PATCH | `/api/driver/bookings/:id/decline` | driver | Decline a request |
| PATCH | `/api/driver/bookings/:id/status` | driver | `{ status: arrived \| started \| completed \| cancelled }` |
| GET | `/api/notifications` | rider or driver | `{ unread, items }` |
| PATCH | `/api/notifications/read-all` , `/:id/read` | rider or driver | Mark as read |

Car types are `Compact`, `Sedan`, `SUV`, `Van` (default per-km rates in `utils/fare.js`).
Fare = base N1,500 + road distance x price per km + N500 service fee.

## What changed from your original

- `server.js` loads `.env` **first**. Before, `JWT_SECRET` was read before `dotenv` ran, so tokens were
  signed with the insecure fallback secret.
- Sign-up only accepts the expected fields. Before, `User.create(req.body)` let a client set `role`,
  and a driver set their own `rating`.
- Emails are stored lower-case, passwords need 6+ characters.
- Drivers can log in with email or phone. New driver fields: `driverId`, `photo`, `verification`, and the
  car gained `year`, `color`, `photo`.
- New: `Booking` and `Notification` models, and the car / booking / driver / notification routes above.
