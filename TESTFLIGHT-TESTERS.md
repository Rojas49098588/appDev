# Adding internal testers on TestFlight

Internal testers can install Mustang Closet's iPhone builds through TestFlight without Apple reviewing the build first. Each tester must be a **user on your App Store Connect team**, so adding someone takes two parts: invite them to the team, then add them to the testing group.

Limit: 100 internal testers.

## Before you start

- You need the **Account Holder** or **Admin** role in App Store Connect. The person who pays for the Apple Developer Program has this.
- You need the tester's **email address**. It should be the Apple ID they use on their iPhone. If it's a different email, they can still accept, but they'll have to sign in to TestFlight with whichever Apple ID they accept with.

## Part 1: Invite them to your App Store Connect team

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) and open **Users and Access** (top menu, or the menu under your name).
2. Click the **+** button next to **People**.
3. Fill in their **first name**, **last name** and **email**.
4. Choose a role. **Marketing** or **Customer Support** is enough for testing and can't change the app. Only pick **Developer** or **Admin** if they'll also help manage the app.
5. Under **Apps**, give them access to **Mustang Closet**. Either choose it from the list, or leave **Access to all apps** on.
6. Click **Invite**.
7. **The tester must accept.** Apple emails them an invitation to join the team. They open it, sign in with their Apple ID, and accept. Until they do, they show as "Invited" and can't be added to a testing group.

## Part 2: Add them to the testing group

1. In App Store Connect, open **Apps → Mustang Closet → TestFlight**.
2. In the left sidebar, under **Internal Testing**, click the group (for example **Testers**).
3. Open the **Testers** tab and click **+**.
4. Tick the people to add and click **Add**.
5. Apple emails each tester a TestFlight invitation.

Make sure the group has a build in it: **Builds** tab → **+** → choose the newest build. To skip this step for future builds, open the group's **Settings** tab and turn on **Automatic Distribution**.

## Part 3: What the tester does on their iPhone

1. Install **TestFlight** from the App Store.
2. Open the TestFlight invitation email **on the iPhone** and tap **View in TestFlight**, then **Accept** and **Install**.
   - If TestFlight shows a code instead, open TestFlight, tap **Redeem**, and enter the code from the email.
3. To get new builds later, open TestFlight, tap **Mustang Closet**, then **Update**.

## Troubleshooting

| Problem | Fix |
|---|---|
| Can't find the person when adding testers | They haven't accepted the team invitation yet (Part 1, step 7), or they weren't given access to Mustang Closet. |
| Tester shows **Invited** in the group | They haven't accepted the TestFlight email. In the group's **Testers** tab, select them and choose **Resend Invitation**. |
| TestFlight says there's nothing to install | The group has no build, or Apple is still processing the new one. Check the group's **Builds** tab. |
| The app doesn't appear in TestFlight | They're signed in to the App Store with a different Apple ID than the one they accepted with. |
| No **Update** button for a new build | Pull down in TestFlight to refresh, and check the build was added to their group. |

## Good to know

- **TestFlight builds use the LIVE database.** Testers sign in or sign up with real accounts and work with real data. The test accounts (`teststaff@mail.com`, `test-…@mustangcloset.test`) only work with test builds (`npm run start:test` or the `test-apk` Android build).
- **Each build expires after 90 days**, so upload a new build before then.
- **People outside your team** (classmates you don't want on App Store Connect) belong in **External Testing**. That needs a one-time Beta App Review, a demo login for Apple, and lets you share a public link.
- **To upload a new build**, see `COMMANDS.md` ("Build the iPhone app and upload it to TestFlight").
