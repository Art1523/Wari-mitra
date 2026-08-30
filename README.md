# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS


## WariMitra AI — voice call prototype

WariMitra AI is a **prototype**. The facility, missing-person and announcement data is
demo data, the call is a browser microphone session (not a telephone line), and no
emergency service, government system or GPS is connected.

### How the voice call works

```
Browser microphone -> Web Speech API (speech to text)
   -> Gemini (intent + landmark + spoken reply)
   -> facilityService (deterministic search of the prototype database)
   -> Gemini (natural Marathi answer)
   -> window.speechSynthesis (text to speech)
   -> microphone opens again
```

Gemini never decides whether a facility exists — the application searches the database
and gives the verified record to Gemini for wording.

### Run locally

1. Create a Gemini API key (optional — see below).
2. Copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY`.
3. `npm install`
4. `npm run dev`

> **Warning:** Frontend Gemini API usage is for prototype/demo purposes. Production
> deployment must move Gemini requests to a secure backend.

By default no key is required: requests go through a server function so the API key
stays on the server. Setting `VITE_GEMINI_API_KEY` switches the app to a direct
browser-to-Gemini call, which is convenient for a local demo but exposes the key.

`.env` is git-ignored — never commit it.

### Browser support

Speech recognition uses the Web Speech API: use **Chrome** or **Edge** (desktop or
Android). Other browsers show a clear message and the demo scenario buttons still work.
Marathi text-to-speech falls back to a Hindi (Devanagari) voice when no `mr-IN` voice is
installed.

### Persistence

All state lives in `localStorage` behind `src/services/*`, so a FastAPI + PostgreSQL
backend can replace it without touching components. No Supabase.

## EXOTEL PHONE AGENT SETUP

The browser call screen (`/voice`) is unchanged. The same WariMitra brain is
now also reachable from a real phone call through Exotel.

```
Phone → Exotel Exophone → Voicebot Applet (WebSocket)
      → /api/public/exotel/voicebot  → STT (Gemini) → WariMitra brain
      → Google Places / location data → Marathi TTS (Gemini) → Exotel → Phone
```

### 1. Credentials you need from the Exotel dashboard

| Secret | Where to find it in Exotel |
| --- | --- |
| `EXOTEL_API_KEY` | Settings → API Credentials → API Key |
| `EXOTEL_API_TOKEN` | Settings → API Credentials → API Token |
| `EXOTEL_ACCOUNT_SID` | Settings → API Credentials → Account SID (subdomain) |
| `EXOTEL_EXOPHONE` | ExoPhones → the virtual number callers will dial |
| `EXOTEL_APP_ID` | App Bazaar → your Call flow → App ID in the URL |

Add them as **project secrets** (server-side environment variables). Never put
them in frontend code or commit them. `GEMINI_API_KEY` is already configured
and powers both speech-to-text and Marathi text-to-speech.

### 2. Endpoints to give Exotel

After publishing the project:

- Voicebot WebSocket: `wss://<your-domain>/api/public/exotel/voicebot`
- Text/test HTTPS API: `https://<your-domain>/api/public/warimitra`

Stable URLs also work: `project--<project-id>.lovable.app`.

### 3. Exotel configuration steps

1. App Bazaar → **Create App** → drag in the **Voicebot** applet
   (also listed as "Voice Streaming / Bidirectional Streaming"; if your account
   does not have it, ask Exotel support to enable Voicebot streaming).
2. In the Voicebot applet, set the WebSocket URL to
   `wss://<your-domain>/api/public/exotel/voicebot`.
3. Save the app, then go to **ExoPhones** and point your number at this app.
4. Call the ExoPhone from any phone. WariMitra greets in Marathi, asks where
   you are, and then answers about medical camps, water, toilets, food,
   pharmacies, rest camps and police/help points.

Audio format expected by this endpoint: 8 kHz, 16-bit, mono PCM, base64 —
Exotel's default voicebot stream format.

### 4. Test the backend without Exotel

```bash
curl -X POST https://<your-domain>/api/public/warimitra \
  -H 'Content-Type: application/json' \
  -d '{"message":"माझ्या जवळ मेडिकल कुठे आहे?","language":"mr","sessionId":"test-1"}'

curl -X POST https://<your-domain>/api/public/warimitra \
  -H 'Content-Type: application/json' \
  -d '{"message":"बेल्हे","language":"mr","sessionId":"test-1"}'
```

The second call must remember the first — the same `sessionId` is one
conversation. Each phone call uses the Exotel call SID as its session ID, so
memory is isolated per call.

### 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Call connects, silence | Voicebot applet URL wrong or not `wss://`. Check the published domain. |
| `426` when opening the URL in a browser | Expected — it is a WebSocket endpoint. |
| Agent replies "सेवा उपलब्ध नाही" | Gemini or Places call failed; check server logs and `GEMINI_API_KEY`. |
| "I could not find that place" | Say a village/temple/toll plaza name; the geocoder is restricted to Maharashtra. |
| Agent keeps asking for location | Speech was not recognised as a place — speak the village name alone. |

### Honesty note

This is a hackathon prototype. There is no emergency-service dispatch and no
government integration; missing-Warkari records made over the phone live in
server memory for the duration of the session.
