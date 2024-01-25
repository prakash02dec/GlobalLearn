import * as dotenv from "dotenv";
dotenv.config();

import mongoose, { Document, model, Schema } from "mongoose";
import bycrpt from "bcryptjs";
import jwt, { Secret } from "jsonwebtoken";

const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IUser extends Document {
    // IUser is the interface for the user document. It is used to define the type of the user document
    name: string;
    email: string;
    password: string;
    avatar: {
        public_id: string; // public_id is the name of the image in cloudinary
        url: string;
    };
    role: string;
    isVerified: boolean;
    courses: Array<{ courseId: string }>;
    comparePassword: (enteredPassword: string) => Promise<boolean>;
    SignAccessToken: () => string;
    SignRefreshToken: () => string;
}

const userSchema: Schema<IUser> = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please enter your name"],
            maxLength: [30, "Your name cannot exceed 30 characters"],
        },
        email: {
            type: String,
            required: [true, "Please enter your email"],
            unique: true,
            validate: {
                validator: (email: string) => {
                    return emailRegexPattern.test(email);
                },
                message: (props) => `${props.value} is not a valid email`,
            },
        },
        password: {
            type: String,
            minLength: [6, "Your password must be longer than 6 characters"],
            select: false, // this will not show the password in the response
        },
        avatar: {
            public_id: String,
            url: String,
        },
        role: {
            type: String,
            default: "user",
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        courses: [
            {
                courseId: String,
                // {
                //     type : Schema.Types.ObjectId,
                //     ref : 'Course'
                // }
            },
        ],
    },
    { timestamps: true }
);

// hash the password before saving the user
userSchema.pre<IUser>("save", async function (next) {
    // this is a middleware that will run before saving the user
    if (!this.isModified("password")) {
        next();
    }
    this.password = await bycrpt.hash(this.password, 10);
    next();
});

// sign access token
userSchema.methods.SignAccessToken = function (): string {
    // this is a method that will be used to sign the access token
    return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN || "", {
        expiresIn: "5m",
    });
};

// sign refresh token
userSchema.methods.SignRefreshToken = function (): string {
    // this is a method that will be used to sign the refresh token
    return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN || "", {
        expiresIn: "3d",
    });
};

// compare user password
userSchema.methods.comparePassword = async function (
    enteredPassword: string
): Promise<boolean> {
    // this is a method that will be used to compare the password entered by the user with the password in the database
    return await bycrpt.compare(enteredPassword, this.password);
};

const userModel = model<IUser>("User", userSchema); // userModel is the model for the user document. It is used to create, read, update and delete the user document

export default userModel;
