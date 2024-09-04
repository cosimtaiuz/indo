"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { headers } from "next/headers";
import Replicate from "replicate";

export async function generateDailyPrompt() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log("Generating daily prompt");

  const themes = [
    "Cars",
    "Ice cream",
    "Sport",
    "Food",
    "Party",
    "Hot day",
    "A brawl after a match",
    "A skiing day in the '90s",
    "Shopping day",
    "Car not working",
    "Someone being selected in the draft",
    "Super intense coding session",
    "Pleasant walk on a spring day",
    "Columbus discovering India, not America",
    "Testing Italian cuisine",
    "Riding a Vespa in SF",
    "A ruined wedding day",
    "Losing connection during a call",
    "A sleepy cat",
    "A dog running a company",
  ];

  const today = new Date();
  const startDate = new Date("2024-09-02");
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const themeIndex = daysSinceStart % themes.length;
  const dailyTheme = themes[themeIndex];

  console.log("today.getTime:", today.getTime);

  console.log("Days since epoch:", daysSinceStart);
  console.log("Daily theme:", dailyTheme);

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that generates a daily text prompt for a game.",
      },
      {
        role: "user",
        content: `Generate a prompt for the game. Use the theme "${dailyTheme}" as inspiration. The prompt should be a
        phrase, and its usage will be to be passed to an AI to generate an image. So it needs to be descriptive, but not so
        cryptic that a user can't guess what it is by looking at the image. And don't use sophisticated words, use words that normal people use.`,
      },
    ],
  });

  if (!chatCompletion.choices[0]?.message?.content) {
    throw new Error("Failed to generate a prompt: No content in the response");
  }

  const generatedPrompt = chatCompletion.choices[0].message.content.trim();

  // Generate embeddings for the prompt
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: generatedPrompt,
    encoding_format: "float",
  });

  if (!embedding.data || embedding.data.length === 0) {
    throw new Error("Failed to generate embeddings: No data in the response");
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const input = {
    prompt: generatedPrompt,
    guidance: 3.5,
    num_outputs: 1,
    aspect_ratio: "1:1",
    output_format: "webp",
    output_quality: 80,
    prompt_strength: 0.9,
    num_inference_steps: 28,
  };

  const generatedImage = (await replicate.run("black-forest-labs/flux-dev", {
    input,
  })) as string[];

  // Fetch the image from the URL
  const response = await fetch(generatedImage[0]);
  const imageBuffer = await response.arrayBuffer();

  const supabase = createClient();

  // Upload the image to Supabase storage
  const { data: imageData, error: imageError } = await supabase.storage
    .from("generated_images")
    .upload(`${Date.now()}.webp`, imageBuffer, {
      contentType: "image/webp",
    });

  if (imageError) {
    console.error("Error uploading image to Supabase:", imageError);
    throw imageError;
  }

  const promptEmbedding = embedding.data[0].embedding;

  const { error: insertError } = await supabase.from("daily_images").insert({
    image_prompt: generatedPrompt,
    prompt_embedding: promptEmbedding,
    image_key: imageData.path,
  });

  if (insertError) {
    console.error("Failed to save the prompt to the database:", insertError);
    throw new Error("Failed to save the prompt to the database");
  }

  console.log("Prompt saved to the database:", generatedPrompt);

  return {
    prompt: generatedPrompt,
    promptEmbedding: promptEmbedding,
  };
}

export async function getDailyImage(): Promise<{
  prompt: string;
  promptEmbedding: string;
  imageUrl: string;
  id: string;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_images")
    .select("id, image_prompt, prompt_embedding, image_key")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("Failed to fetch the daily image:", error);
    throw new Error("Failed to fetch the daily image");
  }

  // Get a presigned URL for the image
  const { data: imageData, error: urlError } = await supabase.storage
    .from("generated_images")
    .createSignedUrl(data.image_key, 60); // URL valid for 60 seconds

  if (urlError) {
    console.error("Failed to generate presigned URL:", urlError);
    throw new Error("Failed to generate presigned URL for the image");
  }

  if (!imageData) {
    throw new Error("No presigned URL generated");
  }

  return {
    prompt: data.image_prompt as string,
    promptEmbedding: data.prompt_embedding as string,
    imageUrl: imageData.signedUrl,
    id: data.id as string,
  };
}

export async function submitGuess(
  guess: string,
  userEmbedding: string,
  dailyImageId: string,
  uid: string
): Promise<UserAnswer> {
  // Generate embedding for the guess
  const openai = new OpenAI();
  const guessEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: guess,
    encoding_format: "float",
  });

  if (!guessEmbedding.data || guessEmbedding.data.length === 0) {
    throw new Error("Failed to generate embeddings for the guess");
  }

  const guessEmbeddingVector = guessEmbedding.data[0].embedding;

  // Calculate cosine similarity between the guess and the daily prompt
  const similarity = cosineSimilarity(
    guessEmbeddingVector,
    JSON.parse(userEmbedding) as number[]
  );

  console.log("Cosine similarity:", similarity);

  // Convert similarity to a percentage
  const closeness = Math.round(similarity * 100);

  // Update the user's answer in the database
  const updatedAnswer = await updateUserAnswer(
    dailyImageId,
    guess,
    closeness,
    uid
  );

  return updatedAnswer;
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export interface User {
  id: string;
  name: string;
  nationality: string;
}

// You'll need to implement this function to check the database
export async function getUserFromDB(nationality?: string): Promise<User> {
  const cookieStore = cookies();
  let uuid = cookieStore.get("user_uuid")?.value;

  if (!uuid) {
    uuid = uuidv4();
    // Set the cookie with a far future expiration date
    cookies().set("user_uuid", uuid, {
      value: uuid,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
      // httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
  }

  // Check the database for a username associated with the UUID
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("name, nationality")
    .eq("id", uuid)
    .single();

  let username = data?.name;
  let userNationality = data?.nationality ?? nationality ?? "US";
  if (!username) {
    // Generate a new username
    username = `User${Math.floor(Math.random() * 10000)}`;
    await saveUsernameToDB(uuid, username, userNationality);
  }

  return { id: uuid, name: username, nationality: userNationality };
}

export async function saveUsernameToDB(
  uuid: string,
  username: string,
  nationality: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .insert([{ id: uuid, name: username, nationality }]);

  if (error) {
    console.error("Failed to save username to the database:", error);
    throw new Error("Failed to save username to the database");
  }
}

export async function getUserCountry(): Promise<string> {
  const headersList = headers();
  const xForwardedFor = headersList.get("x-forwarded-for");
  const xRealIp = headersList.get("x-real-ip");
  console.log("DBS xForwardedFor:", xForwardedFor);
  console.log("DBS xRealIp:", xRealIp);

  let ip: string | null = null;
  if (xRealIp && xRealIp !== "::1") {
    ip = xRealIp;
  } else if (xForwardedFor && xForwardedFor !== "::1") {
    ip = xForwardedFor.split(",")[0].trim();
  }

  console.log("DBS User ip:", ip);

  if (ip === null) {
    return "US";
  }

  // Use a geolocation service API here
  // For example, using ipapi.co (replace with your preferred service)
  const response = await fetch(`https://get.geojs.io/v1/ip/country/${ip}`);
  console.log("DBS User country:", response);
  const data = await response.text();
  console.log("DBS User country:", data);

  return data.trim() || "US"; // Trim the response and default to 'US' if unable to determine
}

export interface UserAnswer {
  id: string;
  uid: string;
  daily_image_id: string;
  answer_text: string;
  answer_valuation: number;
  tries: number;
}

export async function getUserAnswer(
  dailyImageId: string,
  uid: string
): Promise<UserAnswer | null> {
  const supabase = createClient();

  // Check if the user exists in the users table
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (userError) {
    console.error("Error fetching user:", userError);
    throw new Error("Failed to fetch user");
  }

  if (!user) {
    throw new Error("User not found");
  }

  const { data, error } = await supabase
    .from("user_answers")
    .select("*")
    .eq("uid", uid)
    .eq("daily_image_id", dailyImageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No matching row found, return null
      return null;
    }
    console.error("Error fetching user answer:", error);
    throw error;
  }

  return data;
}

export async function updateUserAnswer(
  dailyImageId: string,
  answerText: string,
  answerValuation: number,
  uid: string,
  overrideTries?: number
): Promise<UserAnswer> {
  const supabase = createClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (userError) {
    console.error("Error fetching user:", userError);
    throw new Error("Failed to fetch user");
  }

  if (!user) {
    throw new Error("User not found");
  }

  const existingAnswer = await getUserAnswer(dailyImageId, uid);

  if (existingAnswer) {
    const updateData: Partial<UserAnswer> = {
      answer_text: answerText,
      answer_valuation: Math.max(
        existingAnswer.answer_valuation,
        answerValuation
      ),
    };

    updateData.tries =
      overrideTries !== undefined ? overrideTries : existingAnswer.tries + 1;

    const { data, error } = await supabase
      .from("user_answers")
      .update(updateData)
      .eq("id", existingAnswer.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user answer:", error);
      throw error;
    }

    return data;
  } else {
    const insertData: Partial<UserAnswer> = {
      uid: user.id,
      daily_image_id: dailyImageId,
      answer_text: answerText,
      answer_valuation: answerValuation,
      tries: overrideTries !== undefined ? overrideTries : 1,
    };

    const { data, error } = await supabase
      .from("user_answers")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error inserting user answer:", error);
      throw error;
    }

    return data;
  }
}

export async function dailyUserRanking(
  dailyImageId: string
): Promise<
  (UserAnswer & { user: { id: string; name: string; nationality: string } })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_answers")
    .select("answer_valuation, tries, uid")
    .eq("daily_image_id", dailyImageId)
    .order("answer_valuation", { ascending: false })
    .order("tries", { ascending: true }); // Add this line to sort by tries in ascending order

  if (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }

  console.log("DBS user answers ranked", data.length);

  // Fetch user data for each user answer
  const usersData = await Promise.all(
    data.map(async (answer) => {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name, nationality")
        .eq("id", answer.uid)
        .single();

      if (userError) {
        console.error(
          `Error fetching user data for uid ${answer.uid} while fetching daily ranking:`,
          userError
        );
        return null;
      }

      return {
        ...answer,
        user: userData,
      };
    })
  );

  // Filter out any null results (in case of errors)
  const validUsersData = usersData.filter(Boolean) as (UserAnswer & {
    user: { id: string; name: string; nationality: string };
  })[];

  return validUsersData;
}

// id evaluation tries user_id
export async function yesterdayUserRanking(): Promise<UserAnswer[]> {
  const supabase = createClient();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // First, get yesterday's daily image
  const { data: yesterdayImage, error: imageError } = await supabase
    .from("daily_images")
    .select("id")
    .lt("created_at", yesterday.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (imageError) {
    console.error("Error fetching yesterday's daily image:", imageError);
    throw imageError;
  }

  if (!yesterdayImage) {
    console.error("No daily image found for yesterday");
    return [];
  }

  // Now, fetch user answers for yesterday's image
  const { data, error } = await supabase
    .from("user_answers")
    .select("*")
    .eq("daily_image_id", yesterdayImage.id);

  if (error) {
    console.error("Error fetching yesterday's user answers:", error);
    throw error;
  }

  return data;
}

export async function changeUsername(
  userId: string,
  newName: string
): Promise<User> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ name: newName })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error changing username:", error);
    throw new Error("Failed to change username");
  }

  return data;
}
