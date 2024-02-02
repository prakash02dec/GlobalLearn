import * as dotenv from "dotenv";
dotenv.config();

import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/userModel";

import ErrorHandler from "../utils/errorHandler";
import { catchAsyncError } from "../middleware/catchAsyncError";

import jwt, { Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getUserById } from "../services/user.service";
import cloudinary from "cloudinary";
import CourseModel from "../models/course.model";


// register user 
interface IRegisterationBody {
    name: string,
    email: string,
    password: string,
    avatar?: string,
}

//
export const registrationUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body;
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler("Email already exists", 400));
        };
        const user: IRegisterationBody = {
            name,
            email,
            password,
        };
        const activationToken = createActivationToken(user);
        const activationCode = activationToken.activationCode;
        const token = activationToken.token;

        const data = { user: { name: user.name }, activationCode };
        const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);

        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: "activation-mail.ejs",
                data,
            });
            res.status(201).json({
                success: true,
                message: `Please check your email ${user.email} to activate your account`,
                activationToken: token,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface IActivationToken {
    token: string,
    activationCode: string,
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const token = jwt.sign({ user, activationCode }, process.env.ACTIVATION_SECRET as Secret, { expiresIn: "5m" });

    return { token, activationCode };
};


// activate account 
interface IActivationRequest {
    activation_token: string,
    activation_code: string,
}

export const activateUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activation_token, activation_code } = req.body as IActivationRequest;
        const newUser: { user: IUser, activationCode: string } = jwt.verify(
            activation_token,
            process.env.ACTIVATION_SECRET as string
        ) as { user: IUser, activationCode: string };

        if (newUser.activationCode !== activation_code) {
            return next(new ErrorHandler("Invalid activation code", 400));
        };

        const { name, email, password } = newUser.user;

        const exitUser = await userModel.findOne({ email });

        if (exitUser) {
            return next(new ErrorHandler("Email already exists", 400));
        };

        const user = await userModel.create({
            name,
            email,
            password,
        });

        res.status(201).json({
            success: true,
            message: "Account has been activated"
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// Login user
interface ILoginBody {
    email: string,
    password: string,
}

export const loginUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as ILoginBody;

        if (!email || !password) {
            return next(new ErrorHandler("Please enter email and password", 400));
        };

        const user = await userModel.findOne({ email }).select("+password");
        if (!user) {
            return next(new ErrorHandler("Invalid email or password", 401));
        };

        const isPasswordMatched = await user.comparePassword(password);
        if (!isPasswordMatched) {
            return next(new ErrorHandler("Invalid email or password", 401));
        };

        sendToken(user, 200, res);

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// logout user
export const logoutUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });
        const userId = req.user?._id || "";
        redis.del(userId);

        res.status(200).json({ success: true, message: "Logged out" });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});


// update access token
export const updateAccessToken = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refresh_token = req.cookies.refresh_token as string;
        const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as jwt.JwtPayload;

        const message = "Could not refresh token";

        if (!decoded)
            return next(new ErrorHandler(message, 400));

        const session = await redis.get(decoded.id);
        if (!session)
            return next(new ErrorHandler(message, 400));

        const user = JSON.parse(session);

        const access_token = jwt.sign(
            { id: user._id },
            process.env.ACCESS_TOKEN as string,
            { expiresIn: "5m" }
        );

        const refresh_token_new = jwt.sign(
            { id: user._id },
            process.env.REFRESH_TOKEN as string,
            { expiresIn: "3d" }
        );

        req.user = user;

        res.cookie("access_token", access_token, accessTokenOptions);
        res.cookie("refresh_token", refresh_token_new, refreshTokenOptions);

        res.status(200).json({ status: "success", access_token });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// get user info
export const getUserInfo = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const userId = req.user?._id || "";
        getUserById(userId, res);

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface ISocialAuthBody {
    name: string,
    email: string,
    avatar: string,
}

// social auth
export const socialAuth = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, avatar } = req.body;
        const user = await userModel.findOne({ email });
        if (!user) {
            const user = await userModel.create({ name, email, avatar });
            sendToken(user, 200, res);
        } else {
            sendToken(user, 200, res);
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// update user info
interface IUpdateUserInfo {
    name?: string,
    email?: string,
}

export const updateUserInfo = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email } = req.body as IUpdateUserInfo;

        const userId = req.user?._id || "";

        const user = await userModel.findById(userId);

        if (email && user) {
            const isEmailExist = await userModel.findOne({ email });
            if (isEmailExist)
                return next(new ErrorHandler("Email already exists", 400));
            user.email = email;
        }

        if (name && user) {
            user.name = name;
        };

        await user?.save();

        await redis.set(userId, JSON.stringify(user))

        res.status(200).json({
            success: true,
            user,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// update user password
interface IUpdatePassword {
    oldPassword: string,
    newPassword: string,
}

export const updatePassword = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword } = req.body as IUpdatePassword;

        if (!oldPassword || !newPassword) {
            return next(new ErrorHandler("Please enter old password and new password", 400));
        }

        const userId = req.user?._id || "";

        const user = await userModel.findById(userId).select("+password");

        if (!user)
            return next(new ErrorHandler("User not found", 400));

        // if user is registered with social auth
        if (user?.password == undefined) {
            return next(new ErrorHandler("Invalid user", 400));
        }

        const isPasswordMatched = await user.comparePassword(oldPassword);

        if (!isPasswordMatched)
            return next(new ErrorHandler("Invalid old password", 400));

        user.password = newPassword;

        await user.save();
        await redis.set(userId, JSON.stringify(user));

        res.status(200).json({
            success: true,
            user,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface IUpdateProfilePicture {
    avatar: string,
}

// update profile picture
export const updateProfilePicture = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { avatar } = req.body;

        const userId = req.user?._id || "";
        const user = await userModel.findById(userId);

        if (!user)
            return next(new ErrorHandler("User not found", 400));

        if (avatar) {
            // first delete the old image
            if (user.avatar?.public_id) {

                await cloudinary.v2.uploader.destroy(user.avatar.public_id);
            }
            const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                folder: "avatars",
                width: 150,
            });

            user.avatar = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            }
        }

        await user.save();
        await redis.set(userId, JSON.stringify(user));
        res.status(200).json({
            success: true,
            user,
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

