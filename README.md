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

## Important

The `data/*.json` files are ignored by Git because they are local runtime data. When the server starts, it creates local data files automatically.

This project is good for a portfolio or school project. For real production use, move the JSON data into a database and change the default admin password.
