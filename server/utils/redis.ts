import * as dotenv from 'dotenv';
dotenv.config();


// Redis
import { Redis } from 'ioredis';

const redisClient = () => {
  if (process.env.REDIS_URL) {

    console.log('Redis is connected');
    return process.env.REDIS_URL;
  }
  throw new Error('Redis is not connected');
}
export const redis = new Redis(redisClient());


