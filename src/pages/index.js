import Head from "next/head";
import TerminalSimulator from "@/components/Terminal";
import { useState } from "react";
import TypeformFlow from "@/components/TypeformFlow";
import ThankYou from "@/components/ThankYou";

export default function Home() {
  const [step, setStep] = useState(0);

  return (
    <>
      <Head>
        <title>Frame of Reference</title>
      </Head>
      <main
        className={`flex min-h-screen flex-col items-center justify-between ${
          [1, 7].includes(step) && "bg-gray-100"
        }  `}
      >
        {step === 0 && <TerminalSimulator step={step} setStep={setStep} />}
        {step === 1 && (
          <div className="fixed h-screen overflow-y-auto w-full p-4 flex items-start justify-center pt-12 pb-24">
            <TypeformFlow setStep={setStep} />
          </div>
        )}
        {step === 7 && (
          <div className="fixed h-screen overflow-y-auto w-full p-4 flex items-center justify-center">
            <ThankYou step={step} setStep={setStep} />
          </div>
        )}
      </main>
    </>
  );
}
