import * as dotenv from "dotenv";
dotenv.config();

// mongoDB 

import mongoose from "mongoose";
const dbUrl:string = process.env.DB_URL || '' ;

const connectDB = async () => {
    try{
        await mongoose.connect(dbUrl).then((data : any) => { 
            console.log(`MongoDB is connected with ${data.connection.host}`) 
        });
    }catch (error : any){
        console.log(error.message);
        // then reconnect after 5 seconds
        setTimeout(connectDB , 5000);
    }
}


export default connectDB ;