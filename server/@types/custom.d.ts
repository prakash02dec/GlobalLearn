import { Request } from "express";
import { IUser } from "../models/userModel";

declare global {
  namespace Express {
    interface Request {
      user?: IUser
    }
  }
}
