# Command cheat sheet

Every command runs in PowerShell. Each block starts with its `cd`, so you can paste the whole block.

**Rules of thumb**
- **`development` means TEST and `preview` means LIVE.** Never publish to `testing` with `preview`, or to `live` with `development`.
- **`start:test` means TEST, and plain `expo start` means LIVE.** The same applies to `db:apply:test` (TEST) and `db:apply` (LIVE).
- **Live database changes come last:** merge to master, run `npm run db:apply`, then publish the `live` update.
- **TEST logins and passwords** are in `mobile-app\supabase\.env.test-members.local`. That file isn't uploaded to GitHub.

## TEST (testers, practice data)

Start the app on your computer (TEST database):
```
cd "C:\dev\App Dev\mobile-app"
npm run start:test
```

Publish an update to testers in Expo Go (TEST database):
```
cd "C:\dev\App Dev\mobile-app"
npx eas update --branch testing --environment development --message "describe the change"
```

Build an Android APK for testers (TEST database):
```
cd "C:\dev\App Dev\mobile-app"
npx eas build --platform android --profile test-apk
```

Apply database changes to TEST:
```
cd "C:\dev\App Dev\mobile-app"
npm run db:apply:test
```

Run the database security tests (TEST only):
```
cd "C:\dev\App Dev\mobile-app"
npm run test:rls
```

Create test accounts from a roster CSV (TEST only):
```
cd "C:\dev\App Dev\mobile-app"
npm run test:members -- "C:\Users\legit\Downloads\roster.csv"
```

## LIVE (real members, real data)

Start the app on your computer (LIVE database):
```
cd "C:\dev\App Dev\mobile-app"
npx expo start
```

Publish the app to members in Expo Go (LIVE database):
```
cd "C:\dev\App Dev\mobile-app"
npx eas update --branch live --environment preview --message "describe the change"
```

Build an Android APK (LIVE database):
```
cd "C:\dev\App Dev\mobile-app"
npx eas build --platform android --profile preview
```

Apply database changes to LIVE. Run this only after merging to master:
```
cd "C:\dev\App Dev\mobile-app"
git checkout master
git pull
npm run db:apply
```

## Both

Run the unit tests (no database):
```
cd "C:\dev\App Dev\mobile-app"
npm test
```

Get the latest code:
```
cd "C:\dev\App Dev\mobile-app"
git checkout master
git pull
```

Check which branch you're on:
```
cd "C:\dev\App Dev\mobile-app"
git status
```
