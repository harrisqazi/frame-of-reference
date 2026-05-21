import React, { useEffect, useState } from "react";

const ThankYou = ({ step, setStep }) => {
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setFadeIn(true);
    }, 1000);
  }, []);

  return (
    <div
      className={`h-screen flex items-center font-mono
        transition-opacity duration-3000 w-[400px] max-w-11/12
        ${fadeIn ? "opacity-100 " : "opacity-0"}`}
    >
      <div className="text-center text-gray-900 dark:text-gray-900">
        Your manifestation has entered the ether. Your wish will be fulfilled
        shortly
      </div>
    </div>
  );
};

export default ThankYou;
