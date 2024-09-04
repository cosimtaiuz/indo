"use client";

import { useEffect, useState, useRef } from "react";
import {
  getUserFromDB,
  getUserCountry,
  getDailyImage,
  type UserAnswer,
  getUserAnswer,
  type User,
  dailyUserRanking,
  changeUsername,
  updateUserAnswer,
} from "./server-action";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitGuess } from "./server-action";
import { type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Header from "@/components/header";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

interface GuessPageProps {
  dailyImageData: Awaited<ReturnType<typeof getDailyImage>>;
}

export function GuessPage({ dailyImageData }: GuessPageProps) {
  const leaderboardRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [closeness, setCloseness] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userAnswer, setUserAnswer] = useState<UserAnswer | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    Awaited<ReturnType<typeof dailyUserRanking>>
  >([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isPromptRevealed, setIsPromptRevealed] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const fetchUsernameAndCountry = async () => {
      try {
        const clientCountry = await getUserCountry();
        const fetchedUser = await getUserFromDB(clientCountry);
        const fetchedUserAnswer = await getUserAnswer(
          dailyImageData.id,
          fetchedUser.id
        );
        setUser(fetchedUser);
        setUserAnswer(fetchedUserAnswer);

        // Fetch daily user ranking
        const ranking = await dailyUserRanking(dailyImageData.id);
        setLeaderboard(ranking);
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          title: "Error",
          description: `Failed to fetch user data: ${error}`,
          variant: "destructive",
        });
      }
    };

    fetchUsernameAndCountry();
  }, [dailyImageData.id, toast]);

  if (user === null) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-purple-100">
        <motion.div
          className="w-16 h-16 border-4 border-purple-500 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.5, 1],
            rotate: 360,
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    );
  }

  const handleGuessSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const maxTries = 10;
    const currentTries = userAnswer ? userAnswer.tries : 0;

    if (currentTries >= maxTries) {
      toast({
        title: "Submission Limit Reached",
        description: "You can't submit more than 10 guesses in a day.",
        variant: "default",
      });
      return;
    }

    setIsLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const guess = formData.get("guess") as string;
    try {
      const updatedAnswer = await submitGuess(
        guess,
        dailyImageData.promptEmbedding,
        dailyImageData.id,
        user.id
      );
      setCloseness(updatedAnswer.answer_valuation);
      setUserAnswer(updatedAnswer);

      // Refresh leaderboard after submitting a guess
      const updatedRanking = await dailyUserRanking(dailyImageData.id);
      setLeaderboard(updatedRanking);
    } catch (error) {
      console.error("Error submitting guess:", error);
      toast({
        title: "Error",
        description: `Failed to submit guess: ${error}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));

    const flagEmoji = String.fromCodePoint(...codePoints);
    return flagEmoji;
  };

  const maxTries = 10;
  const remainingTries = maxTries - (userAnswer?.tries || 0);

  const scrollToLeaderboard = () => {
    leaderboardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNameChange = async () => {
    if (newName.trim() && user) {
      try {
        const updatedUser = await changeUsername(user.id, newName.trim());
        setUser(updatedUser);
        setIsEditingName(false);
      } catch (error) {
        console.error("Error changing username:", error);
        toast({
          title: "Error",
          description: "Failed to change username. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleRevealPrompt = async () => {
    if (
      window.confirm(
        "Are you sure? This will use up all your remaining tries for today."
      )
    ) {
      setIsPromptRevealed(true);
      // Update the user's tries to max while keeping the highest score
      const updatedAnswer = await updateUserAnswer(
        dailyImageData.id,
        "Prompt revealed",
        userAnswer ? userAnswer.answer_valuation : 0,
        user.id,
        10
      );
      setUserAnswer(updatedAnswer);

      // Refresh leaderboard after revealing the prompt
      const updatedRanking = await dailyUserRanking(dailyImageData.id);
      setLeaderboard(updatedRanking);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-8">
      <Header />
      <div className="w-full max-w-2xl space-y-8">
        <Card className="shadow-xl">
          <CardHeader className="flex flex-col items-center space-y-4">
            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
                  <span
                    className="text-xl"
                    role="img"
                    aria-label={`${user.nationality} flag`}
                  >
                    {getFlagEmoji(user.nationality)}
                  </span>
                  {isEditingName ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleNameChange();
                      }}
                      className="flex items-center"
                    >
                      <Input
                        ref={nameInputRef}
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="text-sm font-medium text-gray-700 w-32"
                        onBlur={handleNameChange}
                        autoFocus
                      />
                    </form>
                  ) : (
                    <span
                      className="text-sm font-medium text-gray-700 cursor-pointer hover:text-purple-600 transition-colors duration-200"
                      onClick={() => {
                        setIsEditingName(true);
                        setNewName(user.name);
                        setTimeout(() => nameInputRef.current?.focus(), 0);
                      }}
                    >
                      {user.name}
                    </span>
                  )}
                </div>
                <div className="bg-purple-100 text-purple-800 text-sm font-semibold px-3 py-1 rounded-full">
                  {remainingTries} / {maxTries} tries left
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center">
              <p className="text-center text-gray-600">
                Can you guess the prompt used to generate this AI image? Give it
                your best shot!
              </p>
              <Button
                onClick={scrollToLeaderboard}
                variant="link"
                size="sm"
                className="py-2 text-purple-600 font-semibold transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <span>View Leaderboard</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-sm text-gray-600">
              A new image is generated daily. Today&apos;s image is:
            </p>
            <div className="flex justify-center flex-col items-center">
              <Image
                src={dailyImageData.imageUrl}
                alt="AI Generated Image"
                width={400}
                height={300}
                className="rounded-lg shadow-md"
              />
              <p className="text-xs text-gray-500 mt-2">
                Generated with{" "}
                <a
                  href="https://replicate.com/black-forest-labs/flux-dev"
                  target="_blank"
                  className="text-blue-500 hover:text-blue-600"
                >
                  Replicate blf/flux-dev
                </a>
              </p>
            </div>
            <form onSubmit={handleGuessSubmit} className="space-y-4">
              <Textarea
                name="guess"
                placeholder="Enter your guess here..."
                className="w-full resize-none"
                rows={3}
                disabled={
                  isLoading ||
                  (userAnswer?.tries || 0) >= 10 ||
                  isPromptRevealed
                }
              />
              <div className="flex justify-between items-center">
                <Button
                  type="submit"
                  className="flex-grow mr-2"
                  disabled={
                    isLoading ||
                    (userAnswer?.tries || 0) >= 10 ||
                    isPromptRevealed
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (userAnswer?.tries || 0) >= 10 || isPromptRevealed ? (
                    "Daily Limit Reached"
                  ) : (
                    "Submit Guess"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-purple-100 text-purple-800 hover:bg-purple-200"
                  onClick={handleRevealPrompt}
                  disabled={(userAnswer?.tries || 0) >= 10 || isPromptRevealed}
                >
                  Reveal Prompt
                </Button>
              </div>
            </form>
            {isPromptRevealed && (
              <div className="mt-4 p-4 bg-purple-100 rounded-md">
                <h3 className="text-lg font-semibold text-purple-800 mb-2">
                  Revealed Prompt:
                </h3>
                <p className="text-purple-900">{dailyImageData.prompt}</p>
              </div>
            )}
            <AnimatePresence>
              {closeness !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="mt-4"
                >
                  <p className="text-center text-lg font-semibold">
                    Your guess was{" "}
                    <span className="text-purple-600">{closeness}%</span> close!
                  </p>
                  <motion.div
                    className="bg-gray-200 h-4 rounded-full mt-2"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <motion.div
                      className="bg-purple-600 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${closeness}%` }}
                      transition={{
                        duration: 0.8,
                        ease: "easeOut",
                        delay: 0.2,
                      }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          <CardContent className="pt-0"></CardContent>
        </Card>

        {leaderboard.length >= 0 && (
          <div ref={leaderboardRef}>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">
                  Daily Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <li
                      key={entry.user.id}
                      className={`flex justify-between items-center bg-white rounded-lg shadow-sm p-3 transition-all hover:shadow-md ${
                        entry.user.id === user.id ? "bg-purple-100" : ""
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-semibold w-6 text-center">
                          {index === 0 ? "👑" : `${index + 1}.`}
                        </span>
                        <span
                          className="text-2xl"
                          role="img"
                          aria-label={`${entry.user.nationality} flag`}
                        >
                          {getFlagEmoji(entry.user.nationality)}
                        </span>
                        <span className="font-medium">
                          {entry.user.id === user.id
                            ? `${entry.user.name} (You)`
                            : entry.user.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">
                          Tries: {entry.tries}
                        </span>
                        <span className="text-purple-600 font-semibold">
                          {entry.answer_valuation.toFixed(2)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <footer className="mt-12 text-center text-sm text-gray-600">
        <p>
          Made with ❤️ by{" "}
          <Link
            href="https://twitter.com/cosimo_taiuti"
            className="text-purple-600 hover:underline"
          >
            @cosimo_taiuti
          </Link>{" "}
          and{" "}
          <Link
            href="https://twitter.com/albtaiuti"
            className="text-purple-600 hover:underline"
          >
            @albtaiuti
          </Link>{" "}
          -{" "}
          <Link
            href="https://clear-dietician-b7d.notion.site/Gamifying-AI-image-generation-in-a-couple-of-hours-2d902c1e9cc54d5b89fa6cb0981079e6?pvs=4"
            className="text-purple-600 hover:underline"
          >
            Read the blog post
          </Link>
        </p>
      </footer>
    </div>
  );
}
