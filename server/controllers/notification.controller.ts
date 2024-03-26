import NotificationModel from "../models/notification.model";
import { NextFunction , Request , Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import cron from "node-cron";

// get all notification only  for admin
export const getNotifications = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try{
        const notifications = await NotificationModel.find().sort({createdAt: -1,});
        res.status(201).json({
            success: true,
            notifications,
        });
    }catch(error: any){
        return next(new ErrorHandler(error.message, 500));
    }
});

// update notification --only admin

export const updateNotification = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try{
        const notification = await NotificationModel.findById(req.params.id);
        if(!notification){
            return next(new ErrorHandler("Notification not found", 404));
        }else{
            notification.status ? (notification.status = 'read') : notification?.status ;
        }
        await notification.save();
        const notifications = await NotificationModel.find().sort({createdAt: -1,});
        res.status(201).json({
            success: true,
            notifications,
        });
    }catch(error: any){
        return next(new ErrorHandler(error.message, 500));
    }
});



cron.schedule('0 0 0 * * *', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try{
        await NotificationModel.deleteMany({status : 'read' , createdAt: {$lt: thirtyDaysAgo}});
        console.log("Deleted read Notifications");
    } catch(error: any){
        console.log(error.message);
    }
});