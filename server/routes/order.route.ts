import express from 'express';
import { createOrder, getAllOrders } from '../controllers/order.controllers';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
const orderRouter = express.Router();

orderRouter.post('/create-order', isAuthenticated, createOrder);

orderRouter.get('/get-orders', isAuthenticated, authorizeRoles("admin"), getAllOrders);


export default orderRouter;