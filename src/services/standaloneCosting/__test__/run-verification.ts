#!/usr/bin/env tsx

import { runAllVerificationTests } from './calculations.verification';

// 테스트 실행
const success = runAllVerificationTests();

// 종료 코드 설정 (Node.js 환경에서만 실행)
if (typeof process !== 'undefined') {
  (process as any).exit(success ? 0 : 1);
}
