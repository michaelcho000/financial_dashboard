# Procedure Costing API Contract (Draft)

## 1. 공통 규칙
- Base URL: `/api/costing`
- 모든 요청은 `Authorization: Bearer <token>` 헤더와 `X-Tenant-Id` 헤더를 요구한다.
- 응답 포맷: JSON (`application/json; charset=utf-8`).
- 에러 응답: `{ "error": { "code": "LOCKED", "message": "..." } }` 구조를 사용하며 코드 값은 `docs/costing-phase0-foundations.md`의 HTTP 매핑 표를 따른다.
- 페이지네이션은 `?page=`와 `?pageSize=` (기본 1, 50) 쿼리를 사용한다.

## 2. 기준월 관리
### 2.1 GET `/snapshots`
- 설명: 테넌트의 기준월 목록 조회.
- 쿼리: `month`(선택, `YYYY-MM`), `status`(선택: `DRAFT|READY|LOCKED`).
- 응답: `200 OK`
```json
[
  {
    "id": "uuid",
    "month": "2025-03",
    "status": "READY",
    "includeFixedCosts": true,
    "lockedAt": null,
    "lastCalculatedAt": "2025-03-30T12:00:00Z",
    "createdAt": "2025-03-01T00:00:00Z"
  }
]
```

### 2.2 POST `/snapshots`
- 설명: 새 기준월 생성 (신규 혹은 이전 월 복제).
- 본문:
```json
{
  "month": "2025-03",
  "sourceSnapshotId": "uuid 또는 null",
  "includeFixedCosts": true
}
```
- 응답: `201 Created`
- 에러: 동일 월 존재 `409`, 권한 없음 `403`.

### 2.3 PATCH `/snapshots/{id}`
- 설명: 기준월 상태/기본 속성 업데이트.
- 본문 예:
```json
{
  "status": "READY",
  "includeFixedCosts": false
}
```
- 응답: `200 OK`
- 에러: 락 상태 수정 시 `409 LOCKED`.

### 2.4 POST `/snapshots/{id}/lock`
- 설명: 기준월을 잠금 처리.
- 응답: `200 OK`, 실패 시 `409`.

### 2.5 POST `/snapshots/{id}/unlock`
- 설명: 잠금 해제 (admin 전용).
- 응답: `200 OK`, 권한 부족 시 `403`.

## 3. 고정비 선택
### 3.1 GET `/snapshots/{id}/fixed-costs`
- 설명: 기준월에서 선택 가능한 고정비 목록과 현재 선택 상태.
- 응답: `200 OK`
```json
{
  "includeFixedCosts": true,
  "items": [
    {
      "templateId": "uuid",
      "name": "임대료",
      "monthlyCost": 1200000,
      "defaultIncluded": true,
      "included": true
    }
  ]
}
```

### 3.2 PUT `/snapshots/{id}/fixed-costs`
- 설명: 기준월의 고정비 선택 상태 저장.
- 본문:
```json
{
  "includeFixedCosts": true,
  "items": [
    { "templateId": "uuid", "included": true },
    { "templateId": "uuid", "included": false }
  ]
}
```
- 응답: `204 No Content`
- 에러: 락 상태 `409`, 존재하지 않는 템플릿 `404`.

## 4. 인력/소모품 데이터
### 4.1 PUT `/snapshots/{id}/staff`
- 설명: 기준월의 인력 용량 입력 저장.
- 본문(축약):
```json
[
  {
    "roleId": "uuid",
    "roleName": "간호사",
    "monthlyPayroll": 4500000,
    "availableMinutes": 9600
  }
]
```
- 응답: `204 No Content`
- 에러: 락 상태 `409`, 검증 실패 `400`.

### 4.2 PUT `/snapshots/{id}/consumables`
- 설명: 기준월의 소모품 단가 데이터 저장.
- 본문:
```json
[
  {
    "consumableId": "uuid",
    "name": "울쎄라 팁",
    "purchaseCost": 3500000,
    "yieldQuantity": 2400,
    "unit": "shots"
  }
]
```
- 응답: `204 No Content`

## 5. 시술 데이터
### 5.1 GET `/snapshots/{id}/procedures`
- 설명: 시술 목록과 변형(variant) 정보 조회.
- 응답: `200 OK`
```json
[
  {
    "procedureId": "uuid",
    "name": "울쎄라",
    "variants": [
      {
        "variantId": "uuid",
        "salePrice": 990000,
        "totalMinutes": 90,
        "staffMix": [
          { "roleId": "uuid", "participants": 1, "minutes": 60 }
        ],
        "consumables": [
          { "consumableId": "uuid", "quantity": 300 }
        ],
        "equipmentLinks": [
          { "fixedCostTemplateId": "uuid", "notes": "레이저" }
        ]
      }
    ]
  }
]
```

### 5.2 POST `/snapshots/{id}/procedures`
- 설명: 새 시술(또는 변형) 추가.
- 본문: 위 구조 참고. `procedureId` 없으면 새 시술 생성.
- 응답: `201 Created`

### 5.3 PUT `/snapshots/{id}/procedures/{variantId}`
- 설명: 시술 변형 업데이트.
- 응답: `200 OK`

### 5.4 DELETE `/snapshots/{id}/procedures/{variantId}`
- 설명: 변형 삭제.
- 응답: `204 No Content`
- 에러: 계산 결과에 이미 포함된 경우 `409`.

## 6. 계산 & 결과
### 6.1 POST `/snapshots/{id}/recalculate`
- 설명: 원가 계산 실행 (항상 비동기).
- 응답: `202 Accepted`
```json
{
  "status": "QUEUED",
  "jobId": "uuid",
  "queuedAt": "2025-03-30T12:05:00Z"
}
```

### 6.2 GET `/snapshots/{id}/results`
- 설명: 시술별 원가 결과표 조회.
- 쿼리: `sort`, `order`, `search` 등.
- 응답: `200 OK`
```json
[
  {
    "procedureName": "울쎄라",
    "variantName": "기본",
    "caseCount": 42,
    "salePrice": 990000,
    "totalCost": 520000,
    "margin": 470000,
    "marginRate": 0.475,
    "costBreakdown": {
      "labor": 210000,
      "consumables": 130000,
      "facilityFixed": 120000,
      "equipmentFixed": 60000
    }
  }
]
```

### 6.3 GET `/snapshots/{id}/insights`
- 설명: 월간 인사이트 (MOM 비교, KPI).
- 응답: `200 OK`
```json
{
  "topByVolume": { "procedureId": "uuid", "cases": 120 },
  "topByMargin": { "procedureId": "uuid", "margin": 15000000 },
  "lowestMarginRate": { "procedureId": "uuid", "marginRate": 0.08 },
  "mom": {
    "volume": { "current": 320, "previous": 280, "change": 0.1429 },
    "margin": { "current": 48000000, "previous": 42000000, "change": 0.1429 }
  },
  "notes": "시술 B는 마진율이 급락 – 인력 조정 필요"
}
```

### 6.4 GET `/snapshots/{id}/export`
- 설명: CSV/Excel 다운로드.
- 쿼리: `format=csv|xlsx`
- 응답: `200 OK` + 파일 스트림.

## 7. 감사 로그 & 메타
### 7.1 GET `/snapshots/{id}/changes`
- 설명: 기준월 변경 이력 조회 (Phase 6).
- 응답: `200 OK`
```json
[
  {
    "changedAt": "2025-03-10T09:20:00Z",
    "changedBy": { "id": "uuid", "name": "홍길동" },
    "action": "UPDATE_STAFF",
    "details": {
      "roleId": "uuid",
      "field": "monthlyPayroll",
      "previous": 4300000,
      "current": 4500000
    }
  }
]
```

---
- 향후 확장: `GET /snapshots/{id}/summary`(대시보드용), 실시간 계산 상태 업데이트를 위한 WebSocket/Server-Sent Events 도입 검토.
- 문서화: README/AGENTS.md 에 API 사용법을 요약하고, Supabase 연동 시 Endpoint URL 및 인증 흐름을 추가 기재한다.

## 결정 사항 업데이트
- `POST /snapshots/{id}/recalculate` 는 항상 비동기 처리로 고정한다.
- 응답은 `202 Accepted` 와 함께 `{ "status": "QUEUED", "jobId": "uuid", "queuedAt": "ISO8601" }` 형태를 반환한다.
- 클라이언트는 `jobId` 를 활용해 `/snapshots/{id}/results` 또는 `/snapshots/{id}/insights` 를 재조회하거나, 향후 도입할 결과 폴링/푸시 채널을 통해 계산 완료를 감지한다.

