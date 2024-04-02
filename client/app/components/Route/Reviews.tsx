import { styles } from "@/app/styles/style";
import Image from "next/image";
import React from "react";
import ReviewCard from "../Review/ReviewCard";

type Props = {};

export const reviews = [
  {
    name: "Prathamesh P Pai",
    avatar: "https://randomuser.me/api/portraits/men/1.jpg",
    profession: "Student | Cambridge university",
    comment:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis augue lectus, auctor sed nisi id, tempor aliquam urna. Duis cursus quis tellus vel sodales. Aenean finibus finibus purus, non malesuada massa varius sed. Vestibulum eget ligula nec nisi porttitor mollis. Curabitur in risus in velit dignissim aliquet.",
  },
  {
    name: "Prakash Agarwal",
    avatar: "https://randomuser.me/api/portraits/men/1.jpg",
    profession: "Full stack developer | Quarter ltd.",
    comment:
      "Interdum et malesuada fames ac ante ipsum primis in faucibus. Fusce ultrices convallis egestas. Donec eget iaculis dui. In hac habitasse platea dictumst. Maecenas odio ante, feugiat eget tempor ut, dignissim eu arcu. Duis tempor velit id laoreet ultrices. Quisque et odio vel sem lacinia congue.",
  },
];

const Reviews = (props: Props) => {
  return (
    <div className="w-[90%] 800px:w-[85%] m-auto">
      <div className="w-full 800px:flex items-center">
        <div className="800px:w-[50%] w-full">
          <Image
            src={require("../../../public/assests/business-img.png")}
            alt="business"
            width={700}
            height={700}
          />
        </div>
        <div className="800px:w-[50%] w-full">
          <h3 className={`${styles.title} 800px:!text-[40px] pt-1`}>
            Our Students Are <span className="text-gradient">Our Strength</span>{" "}
            <br /> See What They Say About Us
          </h3>
          <br />
          {/* <p className={styles.label}>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Eaque unde
            voluptatum dignissimos, nulla perferendis dolorem voluptate nemo
            possimus magni deleniti natus accusamus officiis quasi nihil
            commodi, praesentium quidem, quis doloribus?
          </p> */}
        </div>
        <br />
        <br />
      </div>
      <div className="grid grid-cols-1 gap-[25px] md:grid-cols-2 md:gap-[25px] lg:grid-cols-2 lg:gap-[25px] xl:grid-cols-2 xl:gap-[35px] mb-12 border-0 md:[&>*:nth-child(3)]:!mt-[-60px] md:[&>*:nth-child(6)]:!mt-[-20px]">
        {reviews &&
          reviews.map((i, index) => <ReviewCard item={i} key={index} />)}
      </div>
    </div>
  );
};

export default Reviews;
