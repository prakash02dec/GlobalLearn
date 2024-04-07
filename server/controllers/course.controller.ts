import * as dotenv from "dotenv";
dotenv.config();

import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel, { IComment } from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import axios from "axios";
import AWS from "aws-sdk";
import FormData from 'form-data';
const fs = require('fs');
const Path = require('path');
const AI_SERVER_URL = process.env.AI_SERVER_URL;
// upload course
export const uploadCourse = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    var data = req.body;
    AWS.config.update({
      region: "ap-south-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    async function downloadAndUploadS3Object(localFilePath: string, key: string, bucket: string, index: number) {
      try {
        const s3 = new AWS.S3();
        const params = {
          Bucket: bucket,
          Key: key,
        };
        // Download the object
        const { Body } = await s3.getObject(params).promise();
        // Write the object content to a local file
        await fs.promises.writeFile(localFilePath, Body);
        console.log(`Object downloaded successfully to ${localFilePath}`);

        const credUrl = "https://dev.vdocipher.com/api/videos";
        const credParams = { title: key };
        const credHeaders = {
          'Authorization': `Apisecret ${process.env.VDOCIPHER_API_SECRET}`
        };

        const response = await axios.put(credUrl, {}, { params: credParams, headers: credHeaders });
        const uploadInfo = response.data;
        const clientPayload = uploadInfo.clientPayload;
        const videoId = uploadInfo.videoId;
        const uploadLink = clientPayload.uploadLink;

        // Prepare form data for file upload
        const formData = new FormData();
        formData.append('x-amz-credential', clientPayload['x-amz-credential']);
        formData.append('x-amz-algorithm', clientPayload['x-amz-algorithm']);
        formData.append('x-amz-date', clientPayload['x-amz-date']);
        formData.append('x-amz-signature', clientPayload['x-amz-signature']);
        formData.append('key', clientPayload['key']);
        formData.append('policy', clientPayload['policy']);
        formData.append('success_action_status', '201');
        formData.append('success_action_redirect', '');
        formData.append('file', fs.createReadStream(localFilePath));

        // Upload file to S3
        const uploadResponse = await axios.post(uploadLink, formData, {
          headers: formData.getHeaders()
        });
        console.log('File uploaded successfully:', uploadResponse.data);

        // Update video URL in course data
        data.courseData[index].videoUrls[0].url = videoId;
        // Delete the local file after successful upload
        await fs.promises.unlink(localFilePath);
        console.log('File deleted successfully');
      } catch (error) {
        console.error('Error downloading and uploading S3 object:', error);
      }
    }
    const promises: any = [];
    for (let i = 0; i < req.body.courseData.length; i++) {
      const match = req.body.courseData[i].s3Url.match(/^s3:\/\/([^/]+)\/(.+)$/);
      const [, bucket, key] = match;
      (async () => {
        const localFilePath = path.join(__dirname, `${key}`);
        try {
          promises.push(downloadAndUploadS3Object(localFilePath, key, bucket, i));
        } catch (error) {
          console.error('Error downloading S3 object:', error);
        }
      })();
    }
    await Promise.all(promises);
    const thumbnail = data.thumbnail;
    if (thumbnail) {
      const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
        folder: "courses",
      });
      data.thumbnail = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      }
    }

    // now creating course and trigger AI server
    const course = await CourseModel.create(data);
    const courseId = course._id;
    axios.post(`${AI_SERVER_URL}/v1/api/dub/video/`, { 'courseId': courseId })
    res.status(201).json({
      success: true,
      course,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
})
const deleteVdocipher = (async (data: any) => {
  for (let i = 0; i < data.courseData.length; i++) {
    for (let j = 0; j < data.courseData[i].videoUrls.length; j++) {
      const currUrl = data.courseData[i].videoUrls[j].url;
      try {
        const url = 'https://dev.vdocipher.com/api/videos';
        const params = { videos: currUrl }; // Assuming currUrl is the video ID
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
        };
        const response = await axios.delete(url, { params: params, headers: headers });
        console.log(response.data); // Handle response data
      } catch (error) {
        console.error('Error:', error); // Handle errors
      }
    }
  }
});

const deleteS3 = (async (data: any) => {
  for (let i = 0; i < data.courseData.length; i++) {
    const currS3 = data.courseData[i].s3Url;
    const match = currS3.match(/^s3:\/\/([^/]+)\/(.+)$/);
    const [, bucket, key] = match;
    // Configure AWS SDK with credentials
    AWS.config.update({
      region: "ap-south-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    // Create an S3 service object
    const s3 = new AWS.S3();
    try {
      // Define the parameters for deleting the object
      const params = {
        Bucket: bucket,
        Key: key
      };
      // Delete the object
      await s3.deleteObject(params).promise();
      console.log("Object deleted successfully");
    } catch (error) {
      console.error("Error deleting object:", error);
    }
  }
});

// edit course
export const editCourse = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    var data = req.body;
    console.log(data);
    const thumbnail = data.thumbnail;
    const courseId = req.params.id;
    const courseData = await CourseModel.findById(courseId) as any;
    await deleteS3(courseData);
    await deleteVdocipher(courseData);
    AWS.config.update({
      region: "ap-south-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    async function downloadAndUploadS3Object(localFilePath: string, key: string, bucket: string, index: number) {
      try {
        const s3 = new AWS.S3();
        const params = {
          Bucket: bucket,
          Key: key,
        };
        // Download the object
        const { Body } = await s3.getObject(params).promise();
        // Write the object content to a local file
        await fs.promises.writeFile(localFilePath, Body);
        console.log(`Object downloaded successfully to ${localFilePath}`);

        const credUrl = "https://dev.vdocipher.com/api/videos";
        const credParams = { title: key };
        const credHeaders = {
          'Authorization': `Apisecret ${process.env.VDOCIPHER_API_SECRET}`
        };

        const response = await axios.put(credUrl, {}, { params: credParams, headers: credHeaders });
        const uploadInfo = response.data;
        const clientPayload = uploadInfo.clientPayload;
        const videoId = uploadInfo.videoId;
        const uploadLink = clientPayload.uploadLink;

        // Prepare form data for file upload
        const formData = new FormData();
        formData.append('x-amz-credential', clientPayload['x-amz-credential']);
        formData.append('x-amz-algorithm', clientPayload['x-amz-algorithm']);
        formData.append('x-amz-date', clientPayload['x-amz-date']);
        formData.append('x-amz-signature', clientPayload['x-amz-signature']);
        formData.append('key', clientPayload['key']);
        formData.append('policy', clientPayload['policy']);
        formData.append('success_action_status', '201');
        formData.append('success_action_redirect', '');
        formData.append('file', fs.createReadStream(localFilePath));

        // Upload file to S3
        const uploadResponse = await axios.post(uploadLink, formData, {
          headers: formData.getHeaders()
        });
        console.log('File uploaded successfully:', uploadResponse.data);

        // Update video URL in course data
        const videoUrls = [
          {
            language: "English",
            url: videoId,
          },
        ]
        data.courseData[index].videoUrls = videoUrls;
        // Delete the local file after successful upload
        await fs.promises.unlink(localFilePath);
        console.log('File deleted successfully');
      } catch (error) {
        console.error('Error downloading and uploading S3 object:', error);
      }
    }
    const promises: any = [];
    for (let i = 0; i < data.courseData.length; i++) {
      const match = data.courseData[i].s3Url.match(/^s3:\/\/([^/]+)\/(.+)$/);
      const [, bucket, key] = match;
      (async () => {
        const localFilePath = path.join(__dirname, `${key}`);
        try {
          promises.push(downloadAndUploadS3Object(localFilePath, key, bucket, i));
        } catch (error) {
          console.error('Error downloading S3 object:', error);
        }
      })();
    }
    await Promise.all(promises);
    if (thumbnail && !thumbnail.startsWith("https")) {
      await cloudinary.v2.uploader.destroy(courseData.thumbnail.public_id);

      const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
        folder: "courses",
      });

      data.thumbnail = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };
    }
    if (thumbnail.startsWith("https")) {
      data.thumbnail = {
        public_id: courseData?.thumbnail.public_id,
        url: courseData?.thumbnail.url,
      };
    }

    const course = await CourseModel.findByIdAndUpdate(
      courseId,
      {
        $set: data,
      },
      { new: true }
    );
    const updatedCourse = await CourseModel.findById(req.params.id).select("-courseData.videoUrls -courseData.s3Url -courseData.suggestion -courseData.questions -courseData.links");
    await redis.set(courseId, JSON.stringify(updatedCourse), "EX", 604800);


    axios.post(`${AI_SERVER_URL}/v1/api/dub/video/`, { 'courseId': courseId })

    res.status(201).json({
      success: true,
      course,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get single course --- without purchasing

export const getSingleCourse = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const courseId = req.params.id;
    const isCacheExist = await redis.get(courseId);

    if (isCacheExist) {
      const course = JSON.parse(isCacheExist);
      res.status(200).json({
        success: true,
        course,
      });
    }
    else {
      const course = await CourseModel.findById(req.params.id).select("-courseData.videoUrls -courseData.s3Url -courseData.suggestion -courseData.questions -courseData.links");
      await redis.set(courseId, JSON.stringify(course), "EX", 604800); //7 days
      res.status(200).json({
        success: true,
        course,
      });
    }

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get all courses --- without purchasing

export const getAllCourses = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await CourseModel.find().select(
      "-courseData.videoUrls -courseData.s3Url -courseData.suggestion -courseData.questions -courseData.links"
    );

    res.status(200).json({
      success: true,
      courses,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get course content -- only for valid user
export const getCourseByUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userCourseList = req.user?.courses;
    const courseId = req.params.id;

    const courseExits = userCourseList?.find((course: any) => course._id.toString() === courseId);

    if (!courseExits) {
      return next(new ErrorHandler("You are not eligible to access this course", 404));
    }
    const course = await CourseModel.findById(courseId);
    const content = course?.courseData;
    res.status(200).json({
      success: true,
      content,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// add question in course
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}


export const addQuestion = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, courseId, contentId }: IAddQuestionData = req.body;
    const course = await CourseModel.findById(courseId);

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    const couseContent = course?.courseData?.find((item: any) =>
      item._id.equals(contentId)
    );

    if (!couseContent) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    // create a new question object
    const newQuestion: any = {
      user: req.user,
      question,
      questionReplies: [],
    };

    // add this question to our course content
    couseContent.questions.push(newQuestion);

    await NotificationModel.create({
      user: req.user?._id,
      title: "New Question Received",
      message: `You have a new question in ${couseContent.title}`,
    });

    // save the updated course
    await course?.save();

    res.status(200).json({
      success: true,
      course,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// add answer in course question
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { answer, courseId, contentId, questionId }: IAddAnswerData = req.body;
    const course = await CourseModel.findById(courseId);
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    const couseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

    if (!couseContent) {
      return next(new ErrorHandler("Invalid content id", 400));
    }
    const question = couseContent?.questions?.find((item: any) => item._id.equals(questionId));

    if (!question) {
      return next(new ErrorHandler("Invalid question Id", 400));
    }

    // create a new answer object
    const newAnswer: any = {
      user: req.user,
      answer,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // add this answer to our course content
    question.questionReplies.push(newAnswer);

    await course?.save();

    if (req.user?._id === question.user._id) {
      // create a notification
      await NotificationModel.create({
        user: req.user?._id,
        title: "New Answer",
        message: `You have new question reply in ${couseContent.title}`,
      });

    } else {
      const data = {
        name: question.user.name,
        title: couseContent.title,
      };
      const html = await ejs.renderFile(path.join(__dirname, "../mails/question-reply.ejs"), data);

      try {
        await sendMail({
          email: question.user.email,
          subject: "Question Reply",
          template: "question-reply.ejs",
          data,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
    res.status(200).json({ success: true, course, });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// add review in course
interface IAddReviewData {
  review: string;
  rating: number;
  userId: string;
}

export const addReview = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userCourseList = req.user?.courses;

    const courseId = req.params.id;

    // check if courseId already exists in userCourseList based on _id
    const courseExists = userCourseList?.some(
      (course: any) => course._id.toString() === courseId.toString()
    );

    if (!courseExists) {
      return next(
        new ErrorHandler("You are not eligible to access this course", 404)
      );
    }

    const course = await CourseModel.findById(courseId);

    const { review, rating } = req.body as IAddReviewData;

    const reviewData: any = {
      user: req.user,
      rating,
      comment: review,
    };

    course?.reviews.push(reviewData);

    let avg = 0;

    course?.reviews.forEach((rev: any) => {
      avg += rev.rating;
    });

    if (course) {
      course.ratings = avg / course.reviews.length; // one example we have 2 reviews one is 5 another one is 4 so math working like this = 9 / 2  = 4.5 ratings
    }

    await course?.save();

    await redis.set(courseId, JSON.stringify(course), "EX", 604800); // 7days

    // create notification
    await NotificationModel.create({
      user: req.user?._id,
      title: "New Review Received",
      message: `${req.user?.name} has given a review in ${course?.name}`,
    });


    res.status(200).json({
      success: true,
      course,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});


interface IAddReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}

// add reply in course review
export const addReplyToReview = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comment, courseId, reviewId } = req.body as IAddReviewData;

    const course = await CourseModel.findById(courseId);

    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const review = course?.reviews?.find(
      (rev: any) => rev._id.toString() === reviewId
    );

    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    const replyData: any = {
      user: req.user,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!review.commentReplies) {
      review.commentReplies = [];
    }

    review.commentReplies?.push(replyData);

    await course?.save();

    await redis.set(courseId, JSON.stringify(course), "EX", 604800); // 7days

    res.status(200).json({
      success: true,
      course,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get all courses --- only for admin

export const getAdminAllCourses = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllCoursesService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
// Delete Course --- only for admin

export const deleteCourse = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const course = await CourseModel.findById(id);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }
    await deleteS3(course);
    await deleteVdocipher(course);
    await course.deleteOne({ id });
    await redis.del(id);
    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// generate video url
export const generateVideoUrl = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoId } = req.body;
      const response = await axios.post(
        `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
        { ttl: 300 },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
