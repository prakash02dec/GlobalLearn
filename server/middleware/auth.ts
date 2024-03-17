import * as dotenv from "dotenv" ;
dotenv.config() ;

import { Request , Response , NextFunction } from "express";
import { catchAsyncError } from "./catchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import jwt, { JwtPayload } from 'jsonwebtoken' ;

import { redis } from "../utils/redis";

// authenticated user
export const isAuthenticated = catchAsyncError(async(req : Request , res : Response , next : NextFunction) => {
    const access_token = req.cookies.access_token ;
    if(!access_token)
        return next(new ErrorHandler("Please login to access this resource" , 400)) ;

    const decoded = jwt.verify(access_token , process.env.ACCESS_TOKEN as string ) as JwtPayload ;

    if(!decoded)
        return next(new ErrorHandler("access token is not valid " , 400)) ;

    const user = await redis.get(decoded.id) ;
    // console.log(user) ;

    if(!user)
        return next(new ErrorHandler("Please login to access the resource" , 400)) ;

    req.user = JSON.parse(user) ;

    next() ;

});

// validate user roles
export const authorizeRoles = (...roles : string[]) => {
    return (req : Request , res : Response , next : NextFunction) => {
        if(!roles.includes(req.user?.role || "")){
            return next(new ErrorHandler(`Role ${req.user?.role} is not allowed to access this resource` , 403)) ;
        }
        next() ;
    }
}