"use client";
import React, { FC, useEffect, useState } from "react";
import CourseInformation from "./CourseInformation";
import CourseOptions from "./CourseOptions";
import CourseData from "./CourseData";
import CourseContent from "./CourseContent";
import CoursePreview from "./CoursePreview";
import {
  useEditCourseMutation,
  useGetAllCoursesQuery,
} from "../../../../redux/features/courses/coursesApi";
import { toast } from "react-hot-toast";
import { redirect } from "next/navigation";
import AWS from "aws-sdk";
type Props = {
  id: string;
};

const EditCourse: FC<Props> = ({ id }) => {
  const [editCourse, { isSuccess, error }] = useEditCourseMutation();
  const { data, refetch } = useGetAllCoursesQuery(
    {},
    { refetchOnMountOrArgChange: true }
  );

  const editCourseData = data && data.courses.find((i: any) => i._id === id);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Course Updated successfully");
      redirect("/admin/courses");
    }
    if (error) {
      if ("data" in error) {
        const errorMessage = error as any;
        toast.error(errorMessage.data.message);
      }
    }
  }, [isSuccess, error]);

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (editCourseData) {
      setCourseInfo({
        name: editCourseData.name,
        description: editCourseData.description,
        price: editCourseData.price,
        estimatedPrice: editCourseData?.estimatedPrice,
        tags: editCourseData.tags,
        level: editCourseData.level,
        categories: editCourseData.categories,
        demoUrl: editCourseData.demoUrl,
        thumbnail: editCourseData?.thumbnail?.url,
      });
      setBenefits(editCourseData.benefits);
      setPrerequisites(editCourseData.prerequisites);
      setCourseContentData(editCourseData.courseData);
    }
  }, [editCourseData]);

  const [courseInfo, setCourseInfo] = useState({
    name: "",
    description: "",
    price: "",
    estimatedPrice: "",
    tags: "",
    level: "",
    categories: "",
    demoUrl: "",
    thumbnail: "",
  });
  const [benefits, setBenefits] = useState([{ title: "" }]);
  const [prerequisites, setPrerequisites] = useState([{ title: "" }]);
  var [courseContentData, setCourseContentData] = useState([
    {
      videoFile: {} as File,
      s3Url: "",
      videoUrls: [
        {
          language: "",
          url: "",
        },
      ],
      title: "",
      description: "",
      videoSection: "Untitled Section",
      videoLength: "",
      links: [
        {
          title: "",
          url: "",
        },
      ],
      suggestion: "",
    },
  ]);

  var [courseData, setCourseData] = useState({});
  AWS.config.update({
    region: "ap-south-1",
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_KEY,
  });
  const s3 = new AWS.S3();
  const uploadFileToS3 = (file: any, fileName: any, bucketName: any) => {
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: file,
    };
    return new Promise((resolve, reject) => {
      s3.upload(params, (err: any, data: any) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log("no error");
          resolve(data.Location); // Returns the URL of the uploaded file
        }
      });
    });
  };
  const handleSubmit = async () => {
    // Format benefits array
    const formattedBenefits = benefits.map((benefit) => ({
      title: benefit.title,
    }));
    // Format prerequisites array
    const formattedPrerequisites = prerequisites.map((prerequisite) => ({
      title: prerequisite.title,
    }));
    const uploadPromises = [];
    console.log(courseContentData);
    console.log(courseContentData[0].videoFile.name);
    for (let i = 0; i < courseContentData.length; i++) {
      const file = courseContentData[i].videoFile;
      const fileName = courseContentData[i].videoFile.name;
      const bucketName = "globallearn";
      // Push each upload promise to the array
      uploadPromises.push(
        (async function (index) {
          try {
            const fileUrl: any = await uploadFileToS3(
              file,
              fileName,
              bucketName
            );
            console.log("File uploaded successfully:", fileUrl);
            const fileUrlString = fileUrl.toString();
            const reqUrl = `s3://${bucketName}/${fileName}`;
            courseContentData[index].videoUrls[0] = {
              ...courseContentData[index].videoUrls[0],
              url: reqUrl,
            };
            courseContentData[index].videoUrls[0] = {
              ...courseContentData[index].videoUrls[0],
              language: "English",
            };
            courseContentData[index] = {
              ...courseContentData[index],
              s3Url: reqUrl,
            };
            console.log("praaakaaaaaaashhhhhhhhhhhhhhhhhhhhhhhhhhhhh");
            console.log(courseContentData[index].s3Url);
            courseContentData[index] = {
              ...courseContentData[index],
              videoFile: {} as File,
            };
          } catch (error) {
            console.error("Error uploading file:", error);
          }
        })(i)
      ); // Immediately invoke the closure with the current value of i
    }
    Promise.all(uploadPromises)
      .then(() => {
        console.log("All uploads completed");

        // Format course content array
        var formattedCourseContentData: any = courseContentData.map(
          (courseContent) => ({
            s3Url: courseContent.s3Url,
            videoUrls: courseContent.videoUrls.map((videoUrl) => ({
              language: videoUrl.language,
              url: videoUrl.url,
            })),
            title: courseContent.title,
            description: courseContent.description,
            videoSection: courseContent.videoSection,
            videoLength: courseContent.videoLength,
            links: courseContent.links.map((link) => ({
              title: link.title,
              url: link.url,
            })),
            suggestion: courseContent.suggestion,
          })
        );

        var data = {
          name: courseInfo.name,
          description: courseInfo.description,
          categories: courseInfo.categories,
          price: courseInfo.price,
          estimatedPrice: courseInfo.estimatedPrice,
          tags: courseInfo.tags,
          thumbnail: courseInfo.thumbnail,
          level: courseInfo.level,
          demoUrl: courseInfo.demoUrl,
          totalVideos: courseContentData.length,
          benefits: formattedBenefits,
          prerequisites: formattedPrerequisites,
          courseData: formattedCourseContentData,
        };
        console.log(data);
        setCourseData(data);
      })
      .catch((error) => {
        console.error("Error during upload:", error);
      });
  };

  const handleCourseCreate = async (e: any) => {
    const data = courseData;
    await editCourse({ id: editCourseData?._id, data });
  };

  return (
    <div className="w-full flex min-h-screen">
      <div className="w-[80%]">
        {active === 0 && (
          <CourseInformation
            courseInfo={courseInfo}
            setCourseInfo={setCourseInfo}
            active={active}
            setActive={setActive}
          />
        )}

        {active === 1 && (
          <CourseData
            benefits={benefits}
            setBenefits={setBenefits}
            prerequisites={prerequisites}
            setPrerequisites={setPrerequisites}
            active={active}
            setActive={setActive}
          />
        )}

        {active === 2 && (
          <CourseContent
            active={active}
            setActive={setActive}
            courseContentData={courseContentData}
            setCourseContentData={setCourseContentData}
            handleSubmit={handleSubmit}
          />
        )}

        {active === 3 && (
          <CoursePreview
            active={active}
            setActive={setActive}
            courseData={courseData}
            handleCourseCreate={handleCourseCreate}
            isEdit={true}
          />
        )}
      </div>
      <div className="w-[20%] mt-[100px] h-screen fixed z-[-1] top-18 right-0">
        <CourseOptions active={active} setActive={setActive} />
      </div>
    </div>
  );
};

export default EditCourse;
