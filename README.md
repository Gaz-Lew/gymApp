# FitTrack Pro

A personal gym workout and training web app built with React, TypeScript, Vite, Tailwind CSS, and Firebase.

## Features

- **Authentication**: Email/password login and registration with Firebase Auth
- **Exercise Library**: 35+ preloaded exercises plus custom exercise creation
- **Workout Builder**: Create workout templates with sets, reps, weight, and rest times
- **Weekly Planner**: Assign workouts to days of the week
- **Workout Tracking**: Live session tracking with timer, set logging, and volume calculation
- **History & Progress**: View past workouts with charts for volume and frequency
- **Import/Export**: Backup and restore all data via JSON
- **Responsive Design**: Mobile-first with dark mode support

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Firebase (Auth + Firestore)
- Zustand (state management)
- Recharts (charts)
- Lucide React (icons)
- date-fns (date formatting)

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** > **Email/Password** provider.
3. Create a **Cloud Firestore** database in production or test mode.
4. Go to **Project Settings** > **General** > **Your apps** > **Web app**.
5. Register a web app and copy the Firebase config values.

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Firebase Hosting Deployment

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login and initialize:
   ```bash
   firebase login
   firebase init hosting
   ```
   - Select your project
   - Set public directory to `dist`
   - Configure as single-page app: **Yes**

3. Deploy:
   ```bash
   firebase deploy
   ```

### Important: SPA Redirect Rules

Ensure your `firebase.json` includes rewrite rules for client-side routing:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /exercises/{exerciseId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /workouts/{workoutId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /plans/{planId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Project Structure

```
src/
  components/       # Reusable UI components
  pages/            # Route pages
  context/          # React contexts (Auth)
  store/            # Zustand stores
  services/         # Firebase services
  types/            # TypeScript types
  utils/            # Utilities & seed data
```

## License

MIT
