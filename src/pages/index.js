import Image from "next/image";
import Head from "next/head";
import TerminalSimulator from "@/components/Terminal";
import { useState } from "react";
import SelectOption from "@/components/SelectOption";
import Product from "@/components/Product";
import Service from "@/components/Service";
import API from "@/components/API";
import Invention from "@/components/Invention";
import Solution from "@/components/Solution";
import ThankYou from "@/components/ThankYou";

export default function Home() {
  // use state to keep track of the step of the user journey

  const [step, setStep] = useState(0);

  return (
    <>
      <Head>
        <title>Frame of Reference</title>
      </Head>
      <main
        className={`flex min-h-screen flex-col items-center justify-between ${
          [1, 2, 3, 4, 5, 6].includes(step) && "bg-gray-100"
        }  `}
      >
        {step === 0 && <TerminalSimulator step={step} setStep={setStep} />}
        {step >= 1 && (
          <div className="fixed h-screen overflow-scroll w-full p-4 flex items-center flex-col pt-12 pb-24">
            {[1, 2, 3, 4, 5, 6].includes(step) && (
              <SelectOption step={step} setStep={setStep} />
            )}
            {step === 2 && <Product step={step} setStep={setStep} />}
            {step === 3 && <Service step={step} setStep={setStep} />}
            {step === 4 && <API step={step} setStep={setStep} />}
            {step === 5 && <Invention step={step} setStep={setStep} />}
            {step === 6 && <Solution step={step} setStep={setStep} />}

            {step === 7 && <ThankYou step={step} setStep={setStep} />}
          </div>
        )}
      </main>
    </>
  );
}
