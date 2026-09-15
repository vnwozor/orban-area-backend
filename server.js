import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
import userRoutes from './routes/userRoutes.js'
import driverRoutes from './routes/driverRoutes.js'
import requestRoutes from './routes/requestRoutes.js'

dotenv.config()
connectDB()

const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://your-rider-app.vercel.app',   // replace with your real URL
        'https://your-driver-app.vercel.app',  // replace with your real URL
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'], // "methods" not "method"
    credentials: true, // lowercase "credentials", not "Credential"
}

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/users', userRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/requests', requestRoutes)

app.get('/', (req, res) => res.send('Transport booking API running'))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
