import { GuessPage } from "./guess-page";
import { getDailyImage } from "./server-action";

export default async function Home() {
  const dailyImageData = await getDailyImage();

  return (
    <main className="min-h-screen w-full flex flex-col">
      <GuessPage dailyImageData={dailyImageData} />
    </main>
  );
}
