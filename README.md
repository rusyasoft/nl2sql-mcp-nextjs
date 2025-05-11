# Natural Language to SQL MCP Server

**Built with Next.js and `@vercel/mcp-adapter`**

## Overview

This project is a Model Context Protocol (MCP) server that provides natural language to SQL conversion capabilities using Google's Gemini AI. It allows users to write queries in plain English which get translated into SQL statements based on predefined database schemas.

## Features

- **Natural Language to SQL Conversion**: Converts plain English queries to SQL using Gemini AI
- **Database Schema Awareness**: Includes schema definitions for employees, departments, and projects tables
- **Additional Utility Tools**:
  - Unit conversion (temperature, distance, weight)
  - Date formatting
  - Mathematical calculations
  - Echo functionality for testing

## Setup

1. Clone this repository
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```sh
   npm run dev
   ```

## Database Schemas

The project includes predefined SQL schemas in the `app/schemas` directory for:
- `employees`: Employee records with personal details, salary, and department information
- `departments`: Department information including name, location, and budget
- `projects`: Project details including status, budget, and timeline

## Deployment Notes

This project is ready to deploy on Vercel with the following considerations:

- For Server-Sent Events (SSE) transport, add a Redis instance to your Vercel project and set `REDIS_URL` environment variable (optional and not even needed. I still don't know why it is needed)
- Enable [Fluid compute](https://vercel.com/docs/functions/fluid-compute) for efficient execution
- Set the `GEMINI_API_KEY` environment variable in your Vercel project settings
- For Pro/Enterprise accounts, adjust `maxDuration` to 800 in the app configuration. Yes this means you cannot run this MCP server on Vercel for free tier.

## Testing

You can test the MCP server using the included client script:

```sh
node scripts/test-client.mjs https://your-deployed-url.vercel.app
```

Example queries to try:
- "Find all employees in the IT department earning over 70k"
- "Show me the projects with budgets over 100k"
- "List managers with the most direct reports"
