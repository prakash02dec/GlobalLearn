import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import OrderModel, { IOrder } from "../models/order.model";
import userModel from "../models/userModel";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { getAllOrdersService, newOrder } from "../services/order.services";

// create order
export const createOrder = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, payment_info } = req.body as IOrder;
    const user = await userModel.findById(req.user?._id);

    const courseExistInUser = user?.courses.some((course) => course.toString() === courseId);
    if (courseExistInUser) {
      return next(new ErrorHandler("You already have this course", 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }
    const data: any = {
      courseId: course._id,
      userId: user?._id,
      payment_info,
    }

    const mailData = {
      order: {
        _id: course._id.toString().slice(0.6),
        name: course.name,
        price: course.price,
        date: new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      }
    }
    const html = await ejs.renderFile(path.join(__dirname, "../mails/order-confirmation.ejs"), { order: mailData });

    try {
      if (user) {
        await sendMail({
          email: user.email,
          subject: "Order Confirmation",
          template: "order-confirmation.ejs",
          data: mailData,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }

    user?.courses.push(course?._id);

    await user?.save();

    await NotificationModel.create({
      user: user?._id,
      title: "New Order",
      message: `You have successfully ordered ${course.name}`,
    });

    if (!course.purchased) {
      course.purchased = 0;
    }
    course.purchased += 1;
    // create new order using service
    await course.save();

    newOrder(data, res, next);

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get All orders --- only for admin

export const getAllOrders = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    getAllOrdersService(res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
})