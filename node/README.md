# Credo Ventures Application

This Next.js application handles deal analysis and person management with Trigger.dev orchestration.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Leadspicker API Configuration
LEADSPICKER_API_KEY=your_leadspicker_api_key_here

# Next.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Database Configuration
DATABASE_URL=your_database_url_here

# Trigger.dev Configuration
TRIGGER_SECRET_KEY=your_trigger_secret_key_here
```

## API Endpoints

- `POST /api/webhook/register-new-person` - Webhook for receiving person registration events

## Trigger.dev Tasks

- `add-person-orchestrator` - Main orchestrator for person processing
- `fetch-person-details` - Fetches detailed person information from Leadspicker API

## Deploy as Node Web Service

Click the button below to deploy this app on Render.

<a href="https://render.com/deploy" referrerpolicy="no-referrer-when-downgrade" rel="nofollow">
  <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
</a>

## Deploy as Static Site

1. Modify the code:
    1. In `render.yaml`, replace the definition of the service named `next-js` with the definition that is commented out.
    2. In `next.config.mjs`, uncomment the line that sets `output: "export"`.

2. Commit the code changes to your repository.

3. Click the Deploy to Render button.
