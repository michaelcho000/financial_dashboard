<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1WySWOPavI81PyhU_Bx3bwtb0YE3m54Wi

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Optionally set the `GEMINI_API_KEY` in [.env.local](.env.local)
3. Generate Prisma client & create the local SQLite database:
   - `npm run prisma:generate`
   - `npm run db:push`
4. Run the app (API 서버와 프런트 동시에 실행):
   `npm run dev`
