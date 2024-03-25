import express from 'express';
import { createOrder, getAllOrders, newPayment, sendStripePublishableKey } from '../controllers/order.controllers';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
import { updateAccessToken } from '../controllers/user.controller';
const orderRouter = express.Router();

orderRouter.post('/create-order', updateAccessToken, isAuthenticated, createOrder);

orderRouter.get('/get-orders', updateAccessToken, isAuthenticated, authorizeRoles("admin"), getAllOrders);

orderRouter.get("/payment/stripepublishablekey", sendStripePublishableKey);

orderRouter.post("/payment", isAuthenticated, newPayment);
export default orderRouter;