import * as dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, Request, Response } from 'express';
export const app = express();


import cors from 'cors';
import cookieParser from 'cookie-parser';


// MIDLEWARES

// body parser
app.use(express.json({limit : "50mb"}));
// cookie parser to parse cookies coming from the fontend
app.use(cookieParser());
// cors = cross origin resource sharing
// allows us to make secure requests from the our frontend to the backend server i.e inshort only allowed origins can make requests to the backend server
app.use(cors({
    origin: process.env.ORIGIN , // allow only this origin to make requests to the backend server
}))

// Testing API
app.get("/test" , (req : Request , res : Response , next : NextFunction )=> {
    res.status(200).json({
        success : true,
        message : "API is working"
    })
});

//  unknown route
app.all("*" , (req : Request , res : Response , next : NextFunction )=> {
    const err = new Error(`Route ${req.originalUrl} not found`) as any;
    err.statusCode = 404;
    next(err);
});


