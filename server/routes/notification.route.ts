import express from 'express';
import { getNotifications, updateNotification } from '../controllers/notification.controller';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';


const notificationRouter = express.Router();

notificationRouter.get('/get-all-notifications',isAuthenticated , authorizeRoles("admin") , getNotifications);

notificationRouter.put('/update-notification/:id',isAuthenticated , authorizeRoles("admin") , updateNotification);

export default notificationRouter;