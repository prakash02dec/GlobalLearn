import React, { FC } from "react";
import CoursePlayer from "../../../utils/CoursePlayer";
import { styles } from "../../../../app/styles/style";
import Ratings from "../../../../app/utils/Ratings";
import { IoCheckmarkDoneOutline } from "react-icons/io5";

type Props = {
  active: number;
  setActive: (active: number) => void;
  courseData: any;
  handleCourseCreate: any;
  isEdit?: boolean;
};

const CoursePreview: FC<Props> = ({
  courseData,
  handleCourseCreate,
  setActive,
  active,
  isEdit
}) => {
  const dicountPercentenge =
    ((courseData?.estimatedPrice - courseData?.price) /
      courseData?.estimatedPrice) *
    100;

  const discountPercentengePrice = dicountPercentenge.toFixed(0);

  const prevButton = () => {
    setActive(active - 1);
  };

  const createCourse = () => {
    handleCourseCreate();
  };

  return (
    <div className="w-[90%] m-auto py-5 mb-5">
      <div className="w-full relative">
        <div className="w-full mt-10">
          <CoursePlayer
            videoUrl={courseData?.demoUrl}
            title={courseData?.title}
          />
        </div>
        <div className="flex items-center">
          <h1 className="pt-5 text-[25px] dark:text-[#fff]">
            {courseData?.price === 0 ? "Free" : courseData?.price + "$"}
          </h1>
          <h5 className="pl-3 dark:text-[#fff] text-[20px] mt-2 line-through opacity-80">
            {courseData?.estimatedPrice}$
          </h5>

          <h4 className="pl-5 pt-4 dark:text-[#fff] text-[22px]">
            {discountPercentengePrice}% Off
          </h4>
        </div>

        <div className="flex items-center">
          <div
            className={`${styles.button} !w-[180px] my-3 font-Poppins !bg-[crimson] cursor-not-allowed`}
          >
            Buy Now {courseData?.price}$
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="text"
            name=""
            id=""
            placeholder="Discount code..."
            className={`${styles.input} 1500px:!w-[50%] 1100px:w-[60%] ml-3 !mt-0`}
          />
          <div
            className={`${styles.button} !w-[120px] my-3 ml-4 bg-[#37a39a] font-Poppins cursor-pointer`}
          >
            Apply
          </div>
        </div>
        <p className="pb-1 dark:text-[#fff]">• Source code included</p>
        <p className="pb-1 dark:text-[#fff]">• Full lifetime access</p>
        <p className="pb-1 dark:text-[#fff]">• Certificate of completion</p>
        <p className="pb-3 800px:pb-1 dark:text-[#fff]">• Premium Support</p>
      </div>
      <div className="w-full">
        <div className="w-full 800px:pr-5">
          <br/>
          <h1 className="text-[25px] dark:text-[#fff] font-Poppins font-[600]">
            {courseData?.name}
          </h1>
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center">
              <Ratings rating={0} />
              <h5 className="dark:text-[#fff]">0 Reviews</h5>
            </div>
            <h5 className="dark:text-[#fff]">0 Students</h5>
          </div>
          <br />
          <br />
          <h1 className="dark:text-[#fff] text-[25px] font-Poppins font-[600]">
            What you will learn from this course?
          </h1>
        </div>
        {courseData?.benefits?.map((item: any, index: number) => (
          <div className="w-full flex 800px:items-center py-2" key={index}>
            <div className="w-[15px] mr-1">
              <IoCheckmarkDoneOutline size={20} color="#37a39a"/>
            </div>
            <p className="pl-2 dark:text-[#fff]">{item.title}</p>
          </div>
        ))}
        <br />
        <h1 className="dark:text-[#fff] text-[25px] font-Poppins font-[600]">
          What are the prerequisites for starting this course?
        </h1>
        {courseData?.prerequisites?.map((item: any, index: number) => (
          <div className="w-full flex 800px:items-center py-2" key={index}>
            <div className="w-[15px] mr-1">
              <IoCheckmarkDoneOutline size={20} color="#37a39a" />
            </div>
            <p className="pl-2 dark:text-[#fff]">{item.title}</p>
          </div>
        ))}
        <br />
        {/* course description */}
        <div className="w-full">
          <h1 className="dark:text-[#fff] text-[25px] font-Poppins font-[600]">
            Course Details
          </h1>
          <p className="dark:text-[#fff] text-[18px] mt-[20px] whitespace-pre-line w-full overflow-hidden">
            {courseData?.description}
          </p>
        </div>
        <br />
      </div>
      <div className="w-full flex items-center justify-between">
        <div
          className="w-full 800px:w-[180px] flex items-center justify-center h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
          onClick={() => prevButton()}
        >
          Previous
        </div>
        <div
          className="w-full 800px:w-[180px] flex items-center justify-center h-[40px] bg-[#37a39a] text-center text-[#fff] rounded mt-8 cursor-pointer"
          onClick={() => createCourse()}
        >
         {
          isEdit ? 'Update' : 'Create'
         }
        </div>
      </div>
    </div>
  );
};

export default CoursePreview;
