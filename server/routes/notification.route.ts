import express from 'express';
import { getNotifications, updateNotification } from '../controllers/notification.controller';
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
import { updateAccessToken } from '../controllers/user.controller';


const notificationRouter = express.Router();

notificationRouter.get('/get-all-notifications',updateAccessToken, isAuthenticated , authorizeRoles("admin") , getNotifications);

notificationRouter.put('/update-notification/:id',updateAccessToken, isAuthenticated , authorizeRoles("admin") , updateNotification);

export default notificationRouter;