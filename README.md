# Real-Time Chat App

A secure, scalable real-time chat platform built with Node.js, Express, Socket.IO, MongoDB, and Tailwind CSS.

## Features

- JWT authentication with registration and login
- Public chat rooms and private one-to-one messages
- Message history persisted in MongoDB
- Typing indicators and online user status
- Room creation and live broadcasting via Socket.IO

## Setup

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open the app in your browser at http://localhost:4000

## Notes

- The app serves a static front-end from `public/`.
- Socket.IO authentication uses JWT tokens.
- Chat history is available for rooms and private chats.
