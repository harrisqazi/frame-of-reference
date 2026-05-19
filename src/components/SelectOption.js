import React, { useEffect, useState, useRef } from "react";

const SelectOption = ({ step, setStep }) => {
  const introductionText = `What will you create?
  
  `;

  const ideas = [
    "Recycling infrastructure in Guadalajara",
    "Pacific Islander Venture Fund",
    "A new app or software tool to help people manage their finances",
    "A design for a new product, such as a piece of furniture or a piece of jewelry",
    "A new social media platform that connects people with similar interests",
    "A service that helps people with home organization and decluttering",
    "An API that allows businesses to integrate with a popular third-party tool",
    "A solution for reducing plastic waste in the environment",
    "A local solution for improving transportation in a specific city or town",
    "A global solution for addressing climate change.",
    "A mobile app that helps people track their water intake throughout the day",
    "A recipe for a vegan and gluten-free chocolate cake that doesn't sacrifice taste",
    "A proposal for a startup that provides affordable, healthy meal delivery to college campuses",
    "A design for a new ergonomic office chair that improves posture and reduces back pain",
    "A social media platform that focuses on connecting pet owners with each other and with pet-friendly businesses",
    "A service that helps busy parents organize their family schedules and tasks",
    "An API that allows businesses to access real-time data on weather patterns and climate conditions in their area",
    "A solution for turning plastic waste into eco-friendly building materials",
    "A local solution for improving bike infrastructure in a specific neighborhood or district",
    "A global solution for reducing food waste by optimizing supply chains and reducing spoilage during transportation.",
  ];

  const [typedText, setTypedText] = useState("");
  const [buttonVisible, setButtonVisible] = useState(false);
  const [delayComplete, setDelayComplete] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const currentTextIndex = useRef(0);

  useEffect(() => {
    const initialDelayId = setTimeout(() => setDelayComplete(true), 400);
    return () => clearTimeout(initialDelayId);
  }, []);

  useEffect(() => {
    if (typedText.length >= introductionText.length) {
      setButtonVisible(true);
    }
  }, [typedText, introductionText]);

  useEffect(() => {
    if (!delayComplete) return; // Don't do anything if the initial delay isn't complete

    let currentIdea = currentIndex % ideas.length;
    let fullText = introductionText + ideas[currentIdea];

    if (isWaiting) return; // Don't do anything if we're waiting after typing out a text

    let timeoutLength = isDeleting ? 4 : 12;

    const timerId = setTimeout(() => {
      if (!isDeleting && typedText === fullText) {
        setIsWaiting(true);
        setTimeout(() => {
          setIsWaiting(false);
          setIsDeleting(true);
        }, 350);
      } else if (isDeleting && typedText === introductionText) {
        setIsDeleting(false);
        if (currentIdea < ideas.length - 1) {
          setCurrentIndex((prevIndex) => prevIndex + 1);
        }
      } else {
        setTypedText((prevText) =>
          isDeleting
            ? prevText.slice(0, prevText.length - 1)
            : prevText + fullText[prevText.length]
        );
      }
    }, timeoutLength);

    return () => clearTimeout(timerId); // Clear timeout on unmount
  }, [typedText, isDeleting, isWaiting, introductionText, ideas, currentIndex]);

  const selectedButton = "border-gray-800 text-gray-800 ";
  const unselectedButton = "border-gray-300 text-gray-500";

  const renderText = typedText.split("\n").map((item, key) => {
    // if its an idea, make it green
    if (key > 1) {
      return (
        <span key={key}>
          <span className="text-gray-500">{item}</span>
          <span className="text-cyan-500 ml-1">_</span>
        </span>
      );
    }
    return (
      <span key={key}>
        {item}
        {key === typedText.split("\n").length - 1 ? (
          <span className="text-cyan-500 ml-1">_</span>
        ) : (
          <br />
        )}
      </span>
    );
  });

  return (
    <div className="h-fit max-w-[400px] w-11/12">
      <div className="w-full text-black pt-8 font-mono h-48 ">
        <p>{renderText}</p>
      </div>

      <div
        className={`flex flex-wrap justify-center space-x-4 font-mono transition-opacity duration-3000 ${
          buttonVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          onClick={() => setStep(2)}
          className={`hover:cursor-pointer hover:bg-gray-200 px-4 py-2 my-2 border-2 ${
            [1, 2].includes(step) ? selectedButton : unselectedButton
          } `}
        >
          Product
        </div>
        <div
          onClick={() => setStep(3)}
          className={`hover:cursor-pointer hover:bg-gray-200 px-4 py-2 my-2 border-2 ${
            [1, 3].includes(step) ? selectedButton : unselectedButton
          } `}
        >
          Service
        </div>
        <div
          onClick={() => setStep(4)}
          className={`hover:cursor-pointer hover:bg-gray-200 px-4 py-2 my-2 border-2 ${
            [1, 4].includes(step) ? selectedButton : unselectedButton
          } `}
        >
          API
        </div>
        <div
          onClick={() => setStep(5)}
          className={`hover:cursor-pointer hover:bg-gray-200 px-4 py-2 my-2 border-2 ${
            [1, 5].includes(step) ? selectedButton : unselectedButton
          } `}
        >
          Invention
        </div>
        <div
          onClick={() => setStep(6)}
          className={`hover:cursor-pointer hover:bg-gray-200 px-4 py-2 my-2 border-2 ${
            [1, 6].includes(step) ? selectedButton : unselectedButton
          } `}
        >
          Solution
        </div>
      </div>
    </div>
  );
};

export default SelectOption;
