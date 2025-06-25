# SnapConnect Development Checklist

## 🚀 1. Prerequisites
- [x] Install Node.js (v18 LTS or later) and npm
- [x] Install Expo CLI globally:
  ```bash
  npm install -g expo
  ```
- [x] Create an OpenAI account and generate a GPT-4 API key
- [x] Create a Supabase account
- [x] Install Git and fork/clone the SnapConnect repo

## 🛠️ 2. Project Setup

### 2.1 Initialize Frontend
- [x] Run `expo init snapconnect` and choose **blank (TypeScript)**
- [x] Install dependencies:
  ```bash
  cd snapconnect
  npm install nativewind tailwindcss @expo/vector-icons zustand
  npm install @react-navigation/native @react-navigation/native-stack
  expo install react-native-gesture-handler react-native-reanimated
  ```
- [x] Configure Tailwind (follow NativeWind docs)
- [x] Set up React Navigation (stack & bottom-tabs)

### 2.2 Initialize Backend
- [x] In Supabase dashboard, create new project `snapconnect`
- [x] Enable extensions:
  - [x] `pgvector`
  - [x] `uuid-ossp`
- [x] Create core tables:
  ```sql
  -- users, friendships, snaps, stories, vectors
  /* see PRD §9 Data Model */
  ```
- [x] Set up Supabase Auth (Email + OAuth providers)

### 2.3 Environment Variables
- [x] Create `.env` in frontend root:
  ```env
  EXPO_SUPABASE_URL=your-supabase-url
  EXPO_SUPABASE_ANON_KEY=your-anon-key
  EXPO_OPENAI_KEY=your-openai-api-key
  ```
- [ ] Secure Edge Function keys in Supabase functions config

## 🔐 3. Phase 1: Core Clone Features

### 3.1 Authentication & Friend Management
- [x] Build Sign-Up / Sign-In screens (email + OAuth)
- [x] Hook into Supabase Auth client
- [x] Create "Friends" context (Zustand store)
- [x] UI to search users by email/username → "Add Friend" button
- [x] Backend RPC for adding/removing friendships

### 3.2 Camera + Ephemeral Snaps
- [x] Integrate Expo Camera component
- [x] Build "Snap" screen: photo / video capture
- [x] Upload media to Supabase Storage and obtain public URL
- [x] Insert snap record (with `expires_at`) into Supabase table
- [x] Build "Inbox" screen: list of incoming snaps
- [x] On view, mark read and schedule deletion (client + server TTL)

### 3.3 AR Filters & Effects
- [ ] Integrate basic sticker overlays (PNG assets)
- [ ] Add text, draw, and location-sticker layers
- [ ] Build UI panel to pick filters/effects

### 3.4 Stories & Group Chat
- [ ] "Create Story" flow: select multiple snaps → post to story
- [ ] "View Story" flow: carousel of snaps with timer
- [ ] 1:1 & group chat screens (reuse snaps upload + storage)
- [ ] Real-time sync via Supabase Realtime channels

## 🤖 4. Phase 2: RAG-Powered Travel Enhancements

### 4.1 Setup RAG Infrastructure
- [ ] In Supabase, create `vectors` table (`entity_id`, `embedding`, `context_type`)
- [ ] Install `pgvector` client library in Edge Functions
- [ ] Write Edge Function boilerplate under `/functions/rag`

### 4.2 Local Insight Injector
- [ ] Build "Discover" screen: fetch user GPS coords
- [ ] Edge Function: embed coords + `style_tags`, query vector index + travel KB, return top 5 POIs
- [ ] Display results as cards with map links

### 4.3 Caption Compass
- [ ] Build "Caption Helper" UI: button on Snap preview
- [ ] On tap call Edge Function: embed image + location + profile tags, call OpenAI GPT-4 for 3 caption options
- [ ] Show options; allow "Copy" or "Apply"

### 4.4 Story Snippet Generator
- [ ] Story editor: select up to 6 snaps
- [ ] Edge Function: fetch media URLs & timestamps, call OpenAI with travel context + KB, return cohesive narrated script
- [ ] Render script in story preview

### 4.5 Culture & Cuisine Coach
- [ ] On photo with restaurant landmark → "Food Tips" button
- [ ] Edge Function: reverse-geocode location, query cuisine KB + etiquette tips, return suggestions & stickers

### 4.6 Flashback Explorer
- [ ] Daily background job or on-open check: query snaps where timestamp = today's date last year
- [ ] Notify via push or in-app modal with "Repost with caption"

### 4.7 Itinerary Snapshot
- [ ] Itinerary input screen (textarea or calendar import)
- [ ] Edge Function: parse itinerary text → extract stops & dates, generate a mini infographic (HTML→PNG)
- [ ] Upload snapshot → allow share as snap/story

## 🔧 5. Testing & Deployment

### 5.1 Testing
- [ ] Write unit tests for Edge Functions (Jest)
- [ ] Component tests for React Native screens (React Testing Library)
- [ ] End-to-end tests (Detox or Cypress + Expo web)
- [ ] Manual QA: core flows + AI feature quality checks

### 5.2 Deployment
- [ ] Deploy Supabase Edge Functions & migrate DB changes
- [ ] Deploy frontend to Vercel (for web preview)
- [ ] Build Android & iOS binaries via Expo Application Services
- [ ] Submit to Google Play / Apple App Store