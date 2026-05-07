# EchoMeet

EchoMeet is a real-time communication app with video calling, messaging, and accessibility-focused assistive features.

## Features

- One-to-one video and audio calling with Socket.IO signaling + WebRTC
- In-call text chat
- Voice-to-text live transcription and send-to-peer flow
- Text-to-voice playback for received messages
- Sign-assistance mode in call UI
- AI helper panel for translation/assistant-style responses
- Friend search, requests, acceptance/rejection, and persistent dashboard lists

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Database:** SQLite (`sqlite3`, `sqlite`)
- **Auth/Security:** `bcryptjs`, `jsonwebtoken`
- **AI Integration:** Google Generative AI SDK
- **Dev tools:** Nodemon, Node test runner

## Project Structure

```text
.
├── public/            # Static frontend pages and shared styles
├── routes/            # REST API routes (auth/users)
├── socket/            # Socket.IO event handlers and signaling logic
├── model/             # Data model helpers
├── test/              # Automated tests
├── server.js          # App entry point
├── package.json       # Scripts and dependencies
└── .env.example       # Safe environment template
```

## Local Setup

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

4. Update values in `.env` for your machine.

## Environment Variables

Use `.env.example` as the reference file.

- `PORT` - Server port (default example: `3000`)
- `GEMINI_API_KEY` - API key for AI features
- `JWT_SECRET` - Secret key for JWT signing

## Run Instructions

- Start production mode:

  ```bash
  npm start
  ```

- Start development mode:

  ```bash
  npm run dev
  ```

- Run tests:

  ```bash
  npm test
  ```

## Usage Flow

1. Open `/` and navigate to login/signup.
2. Authenticate to access `/dashboard`.
3. Search users and manage friend requests.
4. Start a call from the friends list.
5. Use in-call features (chat, voice-to-text, text-to-voice, sign/AI tabs).

## Troubleshooting

- **Port already in use:** Change `PORT` in `.env` or stop the process using that port.
- **Camera/microphone blocked:** Allow browser permissions for media devices.
- **LAN testing between devices:** Use the host machine IP and ensure firewall rules allow the app port.
- **Speech recognition support:** Voice-to-text relies on Web Speech API support (best on Chromium-based browsers).
- **Live Server warning:** Run through the Express server (`npm start`) instead of only static Live Server to preserve API/socket behavior.

## Security Notes

- Never commit `.env` or any API keys/secrets.
- Never commit local database files (`*.db`, `*.sqlite`, `*.sqlite3`).
- Rotate credentials immediately if exposure is suspected.

## License

This project is available under the MIT License. Add a `LICENSE` file if you want to publish with an explicit license text.
