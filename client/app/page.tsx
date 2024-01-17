'use client'
import React, {FC, useState} from "react";
import Heading from "./utils/Heading";


interface Props {}


const Page: FC<Props> = (props) => {
  return(
    <div>
      <Heading
       title="GlobalLearn"
       description="GlobalLearn is a Learning Management System"
       keywords="Programming, MERN, Redux, ML"
      />
    </div>
  )
};


export default Page;