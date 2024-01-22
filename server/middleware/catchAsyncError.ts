import { NextFunction, Request, Response } from "express";

export const catchAsyncError = (fn: any) => (req: Request, res: Response, next: NextFunction)  => { // fn is the function that we want to execute
    Promise.resolve(fn(req, res, next)).catch(next);
}