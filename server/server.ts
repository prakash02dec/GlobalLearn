import { connect } from 'http2';
import {app} from './app';

import * as dotenv from 'dotenv';
import connectDB  from './utils/db';

dotenv.config();


// create server 
app.listen( process.env.PORT  , () => {
    console.log(`Server running on port ${process.env.PORT}`) ;
    connectDB() ;

}) ;