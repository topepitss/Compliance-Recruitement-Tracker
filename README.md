# SustainHealth Compliance Tracker

A Node.js project for tracking compliance candidates, required documents, account access, and admin activity history.

## Features

- Landing page built with React from CDN
- Secure login with server sessions
- Verified user registration
- User tracker for candidate records
- Super admin dashboard
- User approval, disable, role changes, and password reset
- Activity history for logins, registrations, tracker saves, and admin updates

## Run Locally

```powershell
npm start
```

Then open:

```text
http://localhost:3000
```

Default super admin:

```text
username: admin
password: bhel2026
```

Default registration code:

```text
BHEL-PRIVATE-2026
```

For a custom registration code:

```powershell
$env:REGISTER_CODE="your-private-code"
npm start
```

For live hosting, set `DATA_DIR` to a persistent disk/folder so new accounts and tracker records survive redeploys. This is required if you do not want newly registered accounts to disappear after pushing code changes:

```powershell
$env:DATA_DIR="C:\sustainhealth-data"
npm start
```

## Important

Tracker records and activity logs are local runtime data and are ignored by Git. Account files, `data/users.json` and `data/users.backup.json`, are kept separately so registered accounts do not reset just because code changes are deployed. For a live production setup, a real database or a persistent `DATA_DIR` is still the safest option.

This project is good for a portfolio or school project. For real production use, move the JSON data into a database and change the default admin password.
