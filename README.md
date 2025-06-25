# SnapConnect

SnapConnect is a Snapchat-style mobile application for travel enthusiasts, augmented with Retrieval-Augmented Generation (RAG) AI features.  It lets users capture ephemeral snaps, share stories, chat with friends, and receive location-aware insights, captions, and travel recommendations – all in one place.

## ✨ Key Features

### Phase 1 – Core Clone
1. **Ephemeral Snaps** – Photo & video capture that self-destructs after viewing
2. **Stories & Group Chat** – Post 24-hour stories, chat 1-to-1 or in groups
3. **AR Filters & Stickers** – Location stickers, text, and drawing tools
4. **Auth & Friends** – Email/OAuth sign-in, add/remove friends, friend suggestions

### Phase 2 – RAG-Powered Travel Enhancements
1. **Local Insight Injector** – AI-surfaced hidden gems near you
2. **Caption Compass** – GPT-4 generates three personalized caption options per snap
3. **Story Snippet Generator** – Turns a series of snaps into a mini-travelogue
4. **Culture & Cuisine Coach** – Recommends local dishes & etiquette tips
5. **Flashback Explorer** – Reminds users of past adventures on the same date
6. **Itinerary Snapshot** – Creates visual infographics from your travel plans

## 🏗️ Tech Stack

| Layer      | Technology                                |
|------------|-------------------------------------------|
| Frontend   | React Native + Expo (TypeScript)          |
| Styling    | NativeWind / Tailwind CSS                 |
| State      | Zustand                                   |
| Navigation | React Navigation (stack + bottom-tabs)    |
| Backend    | Supabase (PostgreSQL, Storage, Realtime)  |
| AI         | OpenAI GPT-4, `pgvector` similarity search|
| DevOps     | GitHub Actions, Expo Application Services |

## 📝 Prerequisites

* Node.js ≥ 18 LTS (tested on v23)
* npm (comes with Node) or yarn / pnpm
* Expo CLI `npm install -g expo`
* Git & a GitHub account
* Supabase account (free tier OK)
* OpenAI API key (GPT-4 access recommended)

## 🚀 Quick Start

```bash
# 1. Clone the repo
$ git clone https://github.com/sadaqat12/snapconnect.git
$ cd snapconnect

# 2. Install dependencies (frontend)
$ cd snapconnect            # Expo project folder
$ npm install               # or yarn

# 3. Create environment variables
$ cp .env.example .env      # then fill with your keys

# 4. Run the app
$ npm run ios               # iOS simulator (macOS only)
$ npm run android           # Android emulator / device
$ npm run web               # Expo web preview
```

### `.env` fields
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_OPENAI_KEY=your-openai-api-key
```

## 🗄️  Backend Setup (Supabase)

1. **Create a new project** called `snapconnect-db`.
2. **Enable extensions**: `pgvector`, `uuid-ossp`.
3. **Run migrations** – execute the SQL in [`/supabase/schema.sql`](#) (coming soon) to create tables: `users`, `friendships`, `snaps`, `stories`, `vectors`.
4. **Auth providers** – enable Email + social OAuth (Google, Apple etc.).

## 📂 Project Structure

```
SnapConnect/
├── snapconnect/          # Expo React Native app
│   ├── App.tsx           # Root component & navigation
│   ├── assets/           # App icons & images
│   ├── components/       # Re-usable UI components (TBD)
│   ├── screens/          # App screens (TBD)
│   ├── tailwind.config.js
│   └── babel.config.js
├── functions/            # Supabase Edge Functions (AI/RAG) (TBD)
├── prd.txt               # Product Requirements Document
├── todolist.md           # Development checklist
└── README.md             # ← you are here
```

## 🤝 Contributing

Pull requests are welcome!  Please open an issue first to discuss major changes.  Make sure to:

1. Fork the repo and create your branch: `git checkout -b feature/awesome`.
2. Commit your changes: `git commit -m "feat: awesome feature"`.
3. Push to the branch: `git push origin feature/awesome`.
4. Open a pull request on GitHub.

> Code style is enforced via ESLint & Prettier (configuration coming soon).

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Travel far, snap often, and let AI tell the story!** 