# App Store Connect – App Privacy Answers (Draft)

These answers reflect the current implementation of ToDo Kanban. Verify against your final build and legal counsel as needed.

## Data Collection
- Do you collect data from this app? – No

The app does not collect data to the developer or any third parties. All user content is stored locally and synced via the user’s personal Apple iCloud account.

## Data Types
If Apple requires selection for data stored in the app on device and synced via iCloud, disclose minimally as “User Content,” stored on device and in user’s iCloud account.

- User Content: Yes
  - Items: Tasks, subtasks, notes, tags
  - Linked to the user: No (developer receives nothing; data is not linked to identity by the developer)
  - Used for tracking: No

No other categories (Contact Info, Health, Financial, Location, Sensitive Info, Contacts, Search History, Browsing History, Identifiers, Purchases, Usage Data, Diagnostics) are collected by the developer.

## Data Use
- Third-party advertising: No
- Developer’s advertising or marketing: No
- Analytics: No
- Product personalization: No
- App functionality: Yes (user content is necessary to provide the core task management functionality and to sync via iCloud under the user’s Apple ID)

## Data Sharing
- Shared with third parties: No (data is stored in the user’s iCloud; not transmitted to the developer)

## Tracking
- Do you or your third-party partners use data for tracking? – No

## iCloud Disclosure (Reviewer Notes)
The app uses Apple iCloud (Key-Value / iCloud Preferences) to sync user-created tasks, notes, and subtasks between the user’s own devices. No developer servers are involved. Users can disable iCloud in iOS settings to keep data on-device only.

## Contact Info for App Store
- Support Email: support@fynesystems.com
- Privacy Policy URL: https://your-domain.example/privacy or in-app `public/privacy.html` (hosted URL preferred)

## Additional Reviewer Info (Optional)
- No sign-in is required. No purchases or subscriptions.
- For testing sync, create items on one device and bring the other device to the foreground to observe automatic sync.

