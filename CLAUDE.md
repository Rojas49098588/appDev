# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The repository root contains standalone scratch files with no build system connecting them:

- `test.py` — standalone Python script, run directly with `python test.py`
- `test.java` — standalone Java file defining `public class test`; run with `javac test.java && java test`

## mobile-app/ (Expo React Native app)

`mobile-app/` is a separate Expo project (TypeScript, blank template) targeting Android and iOS. It runs on Expo SDK 57 (pinned to match the Expo Go app version available for testing on-device — see `mobile-app/AGENTS.md`, which points to versioned Expo docs that must be checked before writing Expo code, since the API surface has changed across versions).

Commands (run from `mobile-app/`):
- `npm start` — start the Expo dev server (Metro + QR code for Expo Go)
- `npm run android` — start with the Android target
- `npm run ios` — start with the iOS target (requires macOS to build; use Expo Go otherwise)
- `npm run web` — start the web target
- `npx expo-doctor` — validate the project setup

Entry point is `index.ts` → `App.tsx`. Config (app name, icons, platform-specific settings) lives in `app.json`.
