"use client";
import { Button } from "./ui/button";

export default function Header() {
  return (
    <div>
      <header>
        <div className="flex justify-center items-center px-4 sm:px-8 md:px-12 lg:px-20 pb-8 sm:pb-10 md:pb-12">
          {" "}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center text-purple-800">
            Indo - Guess the Prompt!
          </h1>
        </div>
      </header>
    </div>
  );
}
