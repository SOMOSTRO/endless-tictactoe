# Endless Tic-Tac-Toe

A modern, high-performance Endless Tic-Tac-Toe web application built with TypeScript, Vite, Web Audio API, and PWA capabilities.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](#pwa-capabilities)

## Core Game Mechanics

This isn't your standard Tic-Tac-Toe. This is **Endless Tic-Tac-Toe**, featuring a FIFO (First-In-First-Out) eviction rule:
- Each player can only have a maximum of **3 marks** on the board at any time.
- When a player places their 4th mark, their **oldest mark is automatically evicted** (removed from the board).
- A tie is impossible! The game will always end in a decisive victory.
- Before a mark is evicted, it visually indicates its "expiring" state so you can strategize your next move.

## Features Breakdown

- **Pass & Play Mode**: Play locally against a friend (HvH mode).
- **3-Tier AI Engine**: Play against the AI in HvAI mode. Features 3 distinct difficulties:
  - **Casual**: Makes random moves for a relaxed game.
  - **Tactical**: Defends against immediate threats and utilizes queue-expiry awareness.
  - **Grandmaster**: Utilizes full Minimax with Alpha-Beta pruning for a near-unbeatable challenge.
  - Opening moves are randomized across all cells to keep every match feeling fresh.
- **Dual-Phase Timer System** *(Tactical & Grandmaster only)*: Time pressure mechanics that punish hesitation:
  - **AI "Lazy Start"**: If you don't move quickly at the start of a match, the AI picks its optimal cell and a visible 2-second countdown begins — when it hits zero, the AI claims that cell.
  - **Player Timeout Penalty**: After each AI move, a hidden grace period begins. If you stall, a 2-second countdown appears on the *worst possible cell* for you (calculated via Inverse Minimax). When it hits zero, your mark is forced there.
  - A sleek SVG ring countdown overlay with neon-colored radial glows provides clear visual feedback during the visible phase.
- **Web Audio Sound Engine**: A custom procedural Web Audio sound engine generating sci-fi inspired sound effects dynamically (no external audio files required!).
- **Modern Dark UI**: A sleek, fully responsive, dark-themed user interface with fluid micro-animations and smooth state transitions.
- **PWA Offline Functionality**: Fully installable as a Progressive Web App. Play offline anywhere, anytime.

## Architecture Overview

The codebase is highly modular, separating game logic, AI, UI, and side-effects.

- `src/game/`: Pure, side-effect free game logic and state manipulation (`gameLogic.ts`).
- `src/ai/`: AI heuristics, difficulty tuning, Minimax, and Inverse Minimax engines (`aiEngine.ts`).
- `src/timer/`: Dual-Phase Timer state machine and countdown logic (`dualPhaseTimer.ts`).
- `src/ui/`: DOM manipulation, rendering, controls, timer overlays, and animations (`boardRenderer.ts`, `controls.ts`, `timerOverlay.ts`, `dom.ts`).
- `src/pwa/`: Service worker registration for offline capabilities.
- `src/utils/`: Generic utility functions for DOM and type safety.
- `src/soundEngine.ts`: The procedural Web Audio API synthesizer.
- `src/constants.ts`: Centralized configuration constants for the app.
- `src/main.ts`: The unified application state manager bridging the core logic, UI, and audio.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (or pnpm/yarn)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/SOMOSTRO/endless-tictactoe.git](https://github.com/SOMOSTRO/endless-tictactoe.git)
   cd endless-tictactoe
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Development Scripts

- **Start Local Dev Server:**
  ```bash
  npm run dev
  ```
  Runs the app in development mode with Hot Module Replacement (HMR).

- **Build for Production:**
  ```bash
  npm run build
  ```
  Compiles TypeScript and bundles the app into the `dist/` folder using Vite.

- **Run Unit Tests:**
  ```bash
  npm test
  ```
  Executes the test suite using Vitest, validating core game mechanics and AI logic.

- **Run Linter:**
  ```bash
  npm run lint
  ```
  Runs ESLint to ensure code quality and standard conformity.

## PWA Capabilities

This application utilizes Vite PWA Plugin to automatically generate service workers. Assets are cached locally, providing a seamless offline experience. Users can install the game directly to their home screen or desktop via their browser's "Install App" prompt.
