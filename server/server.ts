import {app} from './app';
import {v2 as cloudinary} from 'cloudinary' ;
import * as dotenv from 'dotenv';
import connectDB  from './utils/db';

dotenv.config();

// cloudnary config
cloudinary.config({
    cloud_name : process.env.CLOUD_NAME ,
    api_key : process.env.CLOUD_API_KEY ,
    api_secret : process.env.CLOUD_SECRET_KEY
});

// create server 
app.listen( process.env.PORT  , () => {
    console.log(`Server running on port ${process.env.PORT}`) ;
    connectDB() ;
}) ;