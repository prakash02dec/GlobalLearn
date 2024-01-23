import * as dotenv from 'dotenv';
dotenv.config();

import jwt, { Secret } from 'jsonwebtoken';
import { IUser } from '../models/userModel';
import { Response } from 'express';
import { redis } from './redis';


interface ITokenOptions {
    expires : Date ;
    maxAge : number ;
    httpOnly : boolean ;
    sameSite : 'lax' | 'strict' | 'none' | undefined ;
    secure? : boolean ;
}

export const sendToken = (user : IUser , statusCode : number , res : Response ) => {
    const accesstoken = user.SignAccessToken() ;
    const refreshtoken = user.SignRefreshToken() ;

    // upload session to redis
    redis.set(user._id , JSON.stringify({user}) as any) ;

    // parse environment variables to integrates with fallbacks values
    const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || '300' , 10) ;
    const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || '1200' , 10) ;

    // options for cookies
    const accessTokenOptions : ITokenOptions = {
        expires : new Date(Date.now() + accessTokenExpire * 60 * 1000) ,
        maxAge : accessTokenExpire * 60 * 1000 ,
        httpOnly : true ,
        sameSite : 'lax' ,
    };

    const refreshTokenOptions : ITokenOptions = {
        expires : new Date(Date.now() + refreshTokenExpire * 60 * 1000) ,
        maxAge : refreshTokenExpire * 60 * 1000 ,
        httpOnly : true ,
        sameSite : 'lax' ,
    };
    
    // only set secure cookies in production
    if(process.env.NODE_ENV === 'production'){
        accessTokenOptions.secure = true ;
        // refreshTokenOptions.secure = true ;
    }

    res.cookie('access_token' , accesstoken , accessTokenOptions);
    res.cookie('refresh_token' , refreshtoken , refreshTokenOptions);

    res.status(statusCode).json({
        success : true ,
        user ,
        accesstoken ,
        // refreshtoken ,
    });
}


