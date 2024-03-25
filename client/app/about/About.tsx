import React from "react";
import { styles } from "../styles/style";

const About = () => {
  return (
    <div className="text-black dark:text-white">
      <br />
      <h1 className={`${styles.title} 800px:!text-[45px]`}>
        What is <span className="text-gradient">GlobalLearn?</span>
      </h1>

      <br />
      <div className="w-[95%] 800px:w-[85%] m-auto">
        <p className="text-[18px] font-Poppins">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis augue
          lectus, auctor sed nisi id, tempor aliquam urna. Duis cursus quis
          tellus vel sodales. Aenean finibus finibus purus, non malesuada massa
          varius sed. Vestibulum eget ligula nec nisi porttitor mollis.
          Curabitur in risus in velit dignissim aliquet.
          <br />
          <br />
          Sed vulputate lorem necneque ornare, a feugiat leo cursus. Phasellus
          blandit eros condimentum, ultrices lectus sollicitudin, varius leo.
          Interdum et malesuada fames ac ante ipsum primis in faucibus. Fusce
          ultrices convallis egestas. Donec eget iaculis dui. In hac habitasse
          platea dictumst. Maecenas odio ante, feugiat eget tempor ut, dignissim
          eu arcu. Duis tempor velit id laoreet ultrices.
          <br />
          <br />
          Quisque et odio vel sem lacinia congue. Phasellus fringilla, ipsum
          blandit cursus faucibus, lorem nunc rhoncus leo, id consectetur nunc
          ligula in ipsum. Nullam convallis libero quis justo consequat feugiat.
          Sed eu varius sapien, et placerat magna. Sed tincidunt felis
          ultricies, sagittis metus dapibus, varius eros.
          <br />
          <br />
          Fusce non cursus turpis, sit amet faucibus est. Quisque consequat
          suscipit sapien, in aliquet diam mattis sed. Phasellus et ex eget quam
          pharetra lobortis nec ut enim. Nunc lacinia neque nisl, sed
          ullamcorper eros elementum ut.
          <br />
          <br />
          Cras fermentum lobortis ipsum sit amet dapibus. Pellentesque quis
          condimentum lectus. Vestibulum vitae efficitur tortor. Proin porttitor
          risus nec eros iaculis vulputate. Vestibulum ac mi fringilla, euismod
          turpis nec, convallis nunc. Curabitur nisl diam, facilisis in eleifend
          id, accumsan nec est.
        </p>
        <br />
        <span className="text-[22px]">Team GlobalLearn</span>
        <br />
        <br />
        <br />
      </div>
    </div>
  );
};

export default About;
