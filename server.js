// Must be the FIRST import: it loads .env before any other file reads
// process.env (config/jwt.js reads JWT_SECRET the moment it is imported).
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import connectDB from './config/db.js'
import userRoutes from './routes/userRoutes.js'
import driverRoutes from './routes/driverRoutes.js'
import requestRoutes from './routes/requestRoutes.js'
import carRoutes from './routes/carRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import driverPortalRoutes from './routes/driverPortalRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { errorHandler } from './utils/http.js'

connectDB()

// Allow any localhost/127.0.0.1 port in dev (Vite doesn't always land on
// 5173 - if that port's busy it bumps to 5174, 5175, etc.), plus your
// deployed frontend URLs in production. Extra origins can be added without
// editing code: CLIENT_ORIGINS=https://a.vercel.app,https://b.vercel.app
const allowedProdOrigins = [
    'https://your-rider-app.vercel.app',
    'https://your-driver-app.vercel.app',
    ...(process.env.CLIENT_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
]

const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

const corsOptions = {
    origin: (origin, callback) => {
        // requests with no Origin header (curl, Postman, same-origin) are allowed
        if (!origin || isLocalhost(origin) || allowedProdOrigins.includes(origin)) {
            return callback(null, true)
        }
        callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    credentials: true,
}

const app = express()
app.use(cors(corsOptions))
// Profile and car photos arrive as small base64 images, so allow a bit more than the 100kb default.
app.use(express.json({ limit: '2mb' }))

// --- Booking app (rider + driver) ---
app.use('/api/users', userRoutes)
app.use('/api/cars', carRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/driver', driverPortalRoutes) // "me" endpoints for the logged-in driver
app.use('/api/drivers', driverRoutes) // sign up / login / older endpoints

// --- Original on-demand request flow (still available) ---
app.use('/api/requests', requestRoutes)

app.get('/', (req, res) => res.send('Transport booking API running'))
app.use('/api', (req, res) => res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` }))
app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
