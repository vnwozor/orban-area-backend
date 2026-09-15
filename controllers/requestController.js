import Request from '../models/Request.js'
import Driver from '../models/Driver.js'


export const createRequest = async (req, res) => {
    try {
        const { userId, pickupLocation, dropoffLocation, fareEstimate, serviceType } = req.body

        const availableDriver = await Driver.findOne({ available: true })

        const request = await Request.create({
            userId,
            driverId: availableDriver ? availableDriver._id : null,
            pickupLocation,
            dropoffLocation,
            fareEstimate,
            serviceType,
            status: 'pending',
        })

        res.status(201).json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


export const getRequests = async (req, res) => {
    try {
        const filter = {}
        if (req.query.userId) filter.userId = req.query.userId
        if (req.query.driverId) filter.driverId = req.query.driverId
        if (req.query.status) filter.status = req.query.status

        const requests = await Request.find(filter)
            .populate('userId', 'name phone')
            .populate('driverId', 'name phone car currentLocation')
            .sort({ createdAt: -1 })

        res.json(requests)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}

export const getRequestById = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
            .populate('userId', 'name phone')
            .populate('driverId', 'name phone car currentLocation')
        if (!request) return res.status(404).json({ message: 'Request not found' })
        res.json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


export const acceptRequest = async (req, res) => {
    try {
        const { driverId } = req.body
        const request = await Request.findByIdAndUpdate(
            req.params.id,
            { status: 'accepted', driverId },
            { new: true }
        )
            .populate('userId', 'name phone')
            .populate('driverId', 'name phone car currentLocation')
        if (!request) return res.status(404).json({ message: 'Request not found' })
        await Driver.findByIdAndUpdate(driverId, { available: false })
        res.json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


export const rejectRequest = async (req, res) => {
    try {
        const request = await Request.findByIdAndUpdate(
            req.params.id,
            { status: 'declined' },
            { new: true }
        )
        if (!request) return res.status(404).json({ message: 'Request not found' })
        res.json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


export const cancelRequest = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
        if (!request) return res.status(404).json({ message: 'Request not found' })

        if (['completed', 'cancelled', 'declined'].includes(request.status)) {
            return res.status(400).json({ message: `Cannot cancel a request that is already ${request.status}` })
        }

        request.status = 'cancelled'
        await request.save()

        if (request.driverId) {
            await Driver.findByIdAndUpdate(request.driverId, { available: true })
        }

        res.json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


export const driverCancelRequest = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id)
        if (!request) return res.status(404).json({ message: 'Request not found' })

        if (request.status !== 'accepted') {
            return res
                .status(400)
                .json({ message: 'Can only cancel a ride you have accepted but not yet started' })
        }

        const previousDriverId = request.driverId
        request.status = 'pending'
        request.driverId = null
        await request.save()

        if (previousDriverId) {
            await Driver.findByIdAndUpdate(previousDriverId, { available: true })
        }

        res.json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}


export const updateRequestStatus = async (req, res) => {
    try {
        const { status } = req.body
        const allowed = ['pending', 'accepted', 'declined', 'ongoing', 'completed']
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `Invalid status: ${status}` })
        }

        const request = await Request.findByIdAndUpdate(req.params.id, { status }, { new: true })
        if (!request) return res.status(404).json({ message: 'Request not found' })

        if (status === 'completed' && request.driverId) {
            await Driver.findByIdAndUpdate(request.driverId, { available: true })
        }

        res.json(request)
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
}
