# Credo Ventures Internal Tool Portal

## Overview
This is an internal tool portal for Credo Ventures, providing access to portfolio management, deal pipeline, CRM, and fund administration tools.

## Project Structure

### Tools Organization
Each tool is separated into its own page under `/src/pages/tools/`:
- **Portfolio Dashboard** (`/tools/portfolio-dashboard`) - Track portfolio companies and investments
- **Deal Pipeline** (`/tools/deal-pipeline`) - Manage deal flow and opportunities
- **CRM** (`/tools/crm`) - Relationship management with founders and LPs
- **Fund Administration** (`/tools/fund-administration`) - Fund operations and LP reporting
- **Reporting & Analytics** (`/tools/reporting`) - Generate reports and analytics

### Database Schema
Using Prisma ORM with PostgreSQL:
- **User** - Authentication and user management
- **PortfolioCompany** - Portfolio company data
- **Deal** - Deal pipeline management
- **Activity** - Activity logging across tools

## Setup Instructions

### 1. Environment Variables (.env.local)
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL="postgresql://username:password@hostname:port/database"
```

### 2. Render.com PostgreSQL Setup
1. Create a PostgreSQL database on Render.com
2. Copy the External Database URL from Render.com dashboard
3. Replace `DATABASE_URL` in `.env.local` with your Render.com connection string
4. For production, add the same environment variables to your Render.com web service

### 3. Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (for development)
npx prisma db push

# Or create migrations (for production)
npx prisma migrate dev --name init
```

### 4. Google OAuth Setup
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

### 5. Deployment to Render.com
1. Connect your GitHub repository to Render.com
2. Set environment variables in Render.com dashboard
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npm start`

## Technology Stack
- **Framework**: Next.js 15
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: CSS-in-JS with CSS variables
- **Deployment**: Render.com

## Key Features
- ✅ Google OAuth authentication
- ✅ Clean, professional design matching Credo branding
- ✅ Modular tool structure for easy expansion
- ✅ Database schema for venture capital operations
- ✅ Responsive design
- ✅ Ready for Render.com deployment

## Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
npx prisma studio          # Open database browser
npx prisma generate         # Generate Prisma client
npx prisma db push         # Push schema changes
npx prisma migrate dev     # Create migration
```

## Adding New Tools
1. Create new page in `/src/pages/tools/your-tool.js`
2. Import and use the Header component
3. Add navigation link in `/src/components/Header.js`
4. Add any required database models to `/prisma/schema.prisma`
5. Run `npx prisma db push` to update database

## Security Notes
- Never commit `.env.local` to version control
- Use strong secrets for `NEXTAUTH_SECRET`
- Implement proper role-based access control for production
- Validate all user inputs before database operations
- Use Prisma's built-in SQL injection protection

## Support
For technical issues or feature requests, contact the development team.