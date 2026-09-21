import express from 'express'
import {
    createRequest,
    getRequests,
    getRequestById,
    acceptRequest,
    rejectRequest,
    updateRequestStatus,
    cancelRequest,
    driverCancelRequest,
} from '../controllers/requestController.js'

const router = express.Router()

router.post('/', createRequest)
router.get('/', getRequests) // ?userId= or ?driverId= or ?status=
router.get('/:id', getRequestById)
router.patch('/:id/accept', acceptRequest)
router.patch('/:id/reject', rejectRequest)
router.patch('/:id/status', updateRequestStatus)
router.patch('/:id/cancel', cancelRequest)
router.patch('/:id/driver-cancel', driverCancelRequest)

export default router
