# indo - Guess the prompt!

Repository for [Indo](https://indo-chi.vercel.app/), a demo website built to test an idea: how can we gamify Gen AI?
This idea came to us while thinking about how gamification has turned old ideas, such as
language learning, into massive successes (Duolingo), and reflecting upon how AI is
disrupting many industries, from animation to writing, and so on.

It's also an experiment to see how quickly we could build a GenAI app
using modern LLM coding assistants.
The answer was: pretty quickly! About 3 hours, which were mostly spent figuring out
not the code, but the platform integrations.

Read [our blogpost](https://clear-dietician-b7d.notion.site/Gamifying-AI-image-generation-in-a-couple-of-hours-2d902c1e9cc54d5b89fa6cb0981079e6?pvs=4) for more details.

## Getting Started

Install the packages:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Setting up Supabase

We're using Supabase as DB. Setup an account and then create a new project.
Create the following tables:

- daily_images
  - id
  - created_at
  - image_prompt
  - image_key
  - prompt_embedding

- users
  - id
  - created_at
  - name
  - nationality

- user_answers
  - id
  - created_at
  - answer_text
  - answer_valutation
  - uid
  - daily_image_id
  - tries

## Necessary env keys

- [Supabase](https://supabase.com/) (for database)
- [OpenAI](https://platform.openai.com/signup) (for embeddings + assistant)
- [Replicate](https://replicate.com/black-forest-labs/flux-dev) (for generating images)

## Create .env.local file

To run locally, create a `.env.local` file with the following environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
REPLICATE_API_TOKEN=
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License

See the [LICENSE](LICENSE) file for details.

## Credits

- [Cosimo Taiuti](https://github.com/cosimtaiuz)
- [Alberto Taiuti](https://github.com/snowzurfer)
