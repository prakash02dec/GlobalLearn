'use client'
import React, {FC, useState} from "react";
import Heading from "./utils/Heading";
import Header from "./components/Header";



interface Props {}


const Page: FC<Props> = (props) => {
  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(0);

  return(
    <div>
      <Heading
       title="GlobalLearn"
       description="GlobalLearn is a Learning Management System"
       keywords="Programming, MERN, Redux, ML"
      />
      <Header
       open={open}
       setOpen={setOpen}
       activeItem={activeItem}
      />
    </div>
  )
};


export default Page;