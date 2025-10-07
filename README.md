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
   - Provide Supabase credentials so both financial data와 코스팅 모듈 상태가 공유됩니다:
     - `VITE_SUPABASE_URL=https://kqcikrxpamvyrbichwfx.supabase.co`
     - `VITE_SUPABASE_ANON_KEY=<your anon key>`
     - `VITE_COSTING_BACKEND=supabase`
   - Optionally set the `GEMINI_API_KEY` in [.env.local](.env.local)
3. Generate Prisma client & create the local SQLite database:
   - `npm run prisma:generate`
   - `npm run db:push`
4. Run the app (API 서버와 프런트 동시에 실행):
   `npm run dev`

> Supabase 환경 변수를 제공하지 않으면 애플리케이션과 코스팅 모듈 상태는 기본 샘플 데이터로만 유지되고 새로고침 시 초기화됩니다.
