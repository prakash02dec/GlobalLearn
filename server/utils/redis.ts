import * as dotenv from 'dotenv';
dotenv.config();


// Redis
import {Redis} from 'ioredis';

export const redis = () => {
  if(process.env.REDIS_URL){
    const redis =  new Redis(process.env.REDIS_URL);
    console.log('Redis is connected');
    return redis;
  }
  throw new Error('Redis is not connected');
} 


