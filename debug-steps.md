# 웹 디버깅 체크리스트

## 1. 브라우저 확인
- **URL**: http://localhost:3000
- **로그인**: superadmin / adminpass
- **이동**: /admin/settings

## 2. 브라우저 개발자 도구 체크
- **Console**: JavaScript 에러 메시지 확인
- **Network**: 실패한 요청이 있는지 확인
- **Application > Local Storage**: financial_app_db 데이터 확인

## 3. 예상 문제점
- 새로운 계정 ID 구조로 인한 기존 데이터 충돌
- DataTemplateEditor 컴포넌트 렌더링 실패
- SystemSettings 초기화 오류

## 4. 해결 방법
- localStorage 초기화: `localStorage.clear()`
- 브라우저 새로고침
- 개발자 도구에서 에러 메시지 확인 후 수정