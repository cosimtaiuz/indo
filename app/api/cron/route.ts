import { NextResponse } from "next/server";
import { generateDailyPrompt } from "@/app/server-action";
import { createClient } from "@/lib/supabase/server";
export const maxDuration = 60; // This function can run for a maximum of 5 seconds
export const dynamic = "force-dynamic";

export async function GET() {
  console.log("Generating daily prompt");

  // Create Supabase client
  const supabase = createClient();

  // Write debug message to the 'debug' table
  const { error } = await supabase
    .from("debug")
    .insert({ text: "Cron job executed: Generating daily prompt" });

  if (error) {
    console.error("Error writing to debug table:", error);
  }

  const dailyImage = await generateDailyPrompt();
  console.log("Daily image generated yes");

  // Write another debug message after generating the image
  const { error: error2 } = await supabase
    .from("debug")
    .insert({ text: "Daily image generated successfully" });

  if (error2) {
    console.error("Error writing to debug table:", error2);
  }

  return NextResponse.json({ dailyImage });
}
