import express from 'express'
import { searchCars, getCar } from '../controllers/carController.js'

const router = express.Router()

router.get('/', searchCars) // search available cars for a trip
router.get('/:id', getCar) // car details + fare for a trip

export default router
