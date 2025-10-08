/**
 * 계산 정합성 검증 테스트
 * PRD 명세서의 검증 시나리오를 기반으로 계산 로직 검증
 */

import {
  analyzeWeeklySchedule,
  calculateOperationalMinutes,
  calculateStaffMinuteRate,
  calculateMaterialUnitCost,
  buildProcedureBreakdown,
  summarizeFixedCosts,
  calculateWeeklyOperationalMinutes,
} from '../calculations';
import type {
  DayOfWeek,
  OperationalConfig,
  StaffProfile,
  MaterialItem,
  FixedCostItem,
  ProcedureFormValues,
  WeeklyScheduleEntry,
} from '../types';

const DAY_SEQUENCE: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const JS_DAY_TO_DAY: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const buildWeeklySchedule = (
  overrides: Partial<Record<DayOfWeek, { isOpen: boolean; start: string; end: string }>> = {},
): WeeklyScheduleEntry[] =>
  DAY_SEQUENCE.map(day => {
    const override = overrides[day];
    return {
      day,
      isOpen: override?.isOpen ?? false,
      startTime: override?.start ?? '09:00',
      endTime: override?.end ?? '18:00',
    };
  });

const minutesBetween = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

const computeMonthlyMinutesPerBed = (calendarMonth: string, schedule: WeeklyScheduleEntry[]): number => {
  const [yearStr, monthStr] = calendarMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const map = new Map<DayOfWeek, WeeklyScheduleEntry>();
  schedule.forEach(entry => map.set(entry.day, entry));

  let total = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const jsDay = new Date(year, month - 1, day).getDay();
    const entry = map.get(JS_DAY_TO_DAY[jsDay]);
    if (!entry || !entry.isOpen || !entry.startTime || !entry.endTime) {
      continue;
    }
    const duration = minutesBetween(entry.startTime, entry.endTime);
    if (duration > 0) {
      total += duration;
    }
  }
  return total;
};

// PRD 시나리오 1: 월 가용 시간 계산
function testOperationalMinutes() {
  const simpleConfig: OperationalConfig = {
    mode: 'simple',
    simple: {
      operatingDays: 26,
      operatingHoursPerDay: 10,
    },
    weekly: {
      schedule: buildWeeklySchedule(),
      weeksPerMonth: 4.345,
      calendarMonth: '2025-03',
    },
    bedCount: 4,
    notes: undefined,
  };

  const simpleResult = calculateOperationalMinutes(simpleConfig);
  const simpleExpected = 26 * 10 * 60 * 4; // 62,400분

  const weeklySchedule = buildWeeklySchedule({
    MON: { isOpen: true, start: '10:00', end: '19:00' },
    TUE: { isOpen: true, start: '10:00', end: '19:00' },
    WED: { isOpen: true, start: '10:00', end: '19:00' },
    THU: { isOpen: true, start: '10:00', end: '19:00' },
    FRI: { isOpen: true, start: '10:00', end: '19:00' },
    SAT: { isOpen: true, start: '10:00', end: '17:00' },
  });

  const weeklyConfig: OperationalConfig = {
    mode: 'weekly',
    simple: {
      operatingDays: null,
      operatingHoursPerDay: null,
    },
    weekly: {
      schedule: weeklySchedule,
      weeksPerMonth: 4.345,
      calendarMonth: '2025-03',
    },
    bedCount: 4,
    notes: undefined,
  };

  const weeklyResult = calculateOperationalMinutes(weeklyConfig);
  const expectedMonthlyMinutesPerBed = computeMonthlyMinutesPerBed('2025-03', weeklySchedule);
  const weeklyExpected = expectedMonthlyMinutesPerBed * weeklyConfig.bedCount;
  const weeklyPatternMinutes = calculateWeeklyOperationalMinutes(weeklyConfig.weekly);
  const weeklyAnalysis = analyzeWeeklySchedule(weeklyConfig.weekly);

  console.log('✓ Test 1: 월 가용 시간 계산');
  console.log(`  단순 모드 입력: 26일 × 10시간 × 4대 = ${simpleExpected.toLocaleString()}분`);
  console.log(`  단순 모드 결과: ${simpleResult.toLocaleString()}분 (${simpleResult === simpleExpected ? '✅' : '❌'})`);
  console.log('  주간 스케줄 입력: 월~금 10-19시, 토 10-17시, 기준 월 2025-03, 4대');
  console.log(`  주간 패턴(1주): ${weeklyPatternMinutes.toLocaleString()}분`);
  console.log(`  주간 모드 기대값: ${weeklyExpected.toLocaleString()}분 (베드당 ${expectedMonthlyMinutesPerBed.toLocaleString()}분)`);
  console.log(`  주간 모드 결과: ${weeklyResult.toLocaleString()}분 (${weeklyResult === weeklyExpected ? '✅' : '❌'})`);
  console.log(
    `  분석: 월 영업일 ${weeklyAnalysis.openDaysInMonth ?? 0}일, 실효 주 수 ${
      weeklyAnalysis.effectiveWeeks ? weeklyAnalysis.effectiveWeeks.toFixed(3) : 'N/A'
    }주\n`,
  );

  return simpleResult === simpleExpected && weeklyResult === weeklyExpected;
}

// PRD 시나리오 2: 인력 분당 단가 계산
function testStaffMinuteRate() {
  const doctor: StaffProfile = {
    id: 'staff-1',
    name: '의사A',
    role: '의사',
    monthlySalary: 8_000_000,
    workDaysPerMonth: 22,
    workHoursPerDay: 8,
  };

  const result = calculateStaffMinuteRate(doctor);
  const expected = 8_000_000 / (22 * 8 * 60); // 757.58 won/분

  console.log('✓ Test 2: 인력 분당 단가 계산');
  console.log(`  입력: 월급 ${doctor.monthlySalary.toLocaleString()}원, ${doctor.workDaysPerMonth}일, ${doctor.workHoursPerDay}시간`);
  console.log(`  기대값: ${expected.toFixed(2)}원/분`);
  console.log(`  실제값: ${result.toFixed(2)}원/분`);
  console.log(`  결과: ${Math.abs(result - expected) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

  return Math.abs(result - expected) < 0.01;
}

// PRD 시나리오 3: 소모품 단위당 원가
function testMaterialUnitCost() {
  const material: MaterialItem = {
    id: 'mat-1',
    name: '실링재',
    unitLabel: 'cc',
    unitPrice: 50_000,
    unitQuantity: 10,
  };

  const result = calculateMaterialUnitCost(material);
  const expected = 50_000 / 10; // 5,000 won/cc

  console.log('✓ Test 3: 소모품 단위당 원가 계산');
  console.log(`  입력: ${material.name}, ${material.unitPrice.toLocaleString()}원/${material.unitQuantity}개`);
  console.log(`  기대값: ${expected.toLocaleString()}원/개`);
  console.log(`  실제값: ${result.toLocaleString()}원/개`);
  console.log(`  결과: ${result === expected ? '✅ PASS' : '❌ FAIL'}\n`);

  return result === expected;
}

// PRD 시나리오 4: 종합 시술 원가 계산
function testProcedureBreakdown() {
  // 설정
  const operational: OperationalConfig = {
    mode: 'simple',
    simple: {
      operatingDays: 26,
      operatingHoursPerDay: 10,
    },
    weekly: {
      schedule: buildWeeklySchedule(),
      weeksPerMonth: 4.345,
      calendarMonth: '2025-03',
    },
    bedCount: 1,
    notes: undefined,
  };

  const staff: StaffProfile[] = [
    {
      id: 'staff-1',
      name: '의사A',
      role: '의사',
      monthlySalary: 8_000_000,
      workDaysPerMonth: 22,
      workHoursPerDay: 8,
    },
  ];

  const materials: MaterialItem[] = [
    {
      id: 'mat-1',
      name: '실링재',
      unitLabel: 'cc',
      unitPrice: 50_000,
      unitQuantity: 10,
    },
  ];

  const fixedCosts: FixedCostItem[] = [
    {
      id: 'fixed-1',
      name: '임대료',
      monthlyAmount: 3_000_000,
      costGroup: 'facility',
    },
    {
      id: 'fixed-2',
      name: '마케팅 비용',
      monthlyAmount: 1_000_000,
      costGroup: 'marketing',
    },
  ];

  const procedure: ProcedureFormValues = {
    id: 'proc-1',
    name: '보톡스 50U',
    price: 300_000,
    treatmentMinutes: 15,
    totalMinutes: 30, // 상담 + 준비 + 시술 + 정리
    staffAssignments: [
      {
        staffId: 'staff-1',
        minutes: 15,
      },
    ],
    materialUsages: [
      {
        materialId: 'mat-1',
        quantity: 5, // 5cc 사용
      },
    ],
    notes: '',
  };

  const result = buildProcedureBreakdown(procedure, {
    staff,
    materials,
    fixedCosts,
    operational,
  });

  // 기대값 계산
  const staffRate = 8_000_000 / (22 * 8 * 60); // 757.58 won/분
  const expectedDirectLabor = staffRate * 15; // 11,363.64원
  const expectedConsumable = (50_000 / 10) * 5; // 25,000원
  const bedCount = 1;
  const operationalMinutes = 26 * 10 * 60 * bedCount; // 15,600분
  const fixedPerMinute = 3_000_000 / operationalMinutes; // 192.31 won/분
  const expectedFixedAllocated = fixedPerMinute * 30; // 5,769.23원
  const expectedTotalCost = expectedDirectLabor + expectedConsumable + expectedFixedAllocated; // 42,132.87원
  const expectedMargin = 300_000 - expectedTotalCost; // 257,867.13원
  const expectedMarginRate = (expectedMargin / 300_000) * 100; // 85.96%
  const expectedBreakeven = 3_000_000 / (300_000 - (expectedDirectLabor + expectedConsumable)); // 11.36건

  console.log('✓ Test 4: 종합 시술 원가 계산');
  console.log(`  시술: ${procedure.name} (${procedure.price.toLocaleString()}원)`);
  console.log('');
  console.log('  직접 인건비:');
  console.log(`    기대값: ${expectedDirectLabor.toFixed(2)}원`);
  console.log(`    실제값: ${result.directLaborCost.toFixed(2)}원`);
  console.log(`    결과: ${Math.abs(result.directLaborCost - expectedDirectLabor) < 0.01 ? '✅' : '❌'}`);
  console.log('');
  console.log('  소모품비:');
  console.log(`    기대값: ${expectedConsumable.toFixed(2)}원`);
  console.log(`    실제값: ${result.consumableCost.toFixed(2)}원`);
  console.log(`    결과: ${Math.abs(result.consumableCost - expectedConsumable) < 0.01 ? '✅' : '❌'}`);
  console.log('');
  console.log('  고정비 배분:');
  console.log(`    기대값: ${expectedFixedAllocated.toFixed(2)}원`);
  console.log(`    실제값: ${result.fixedCostAllocated.toFixed(2)}원`);
  console.log(`    결과: ${Math.abs(result.fixedCostAllocated - expectedFixedAllocated) < 0.01 ? '✅' : '❌'}`);
  console.log('');
  console.log('  총 원가:');
  console.log(`    기대값: ${expectedTotalCost.toFixed(2)}원`);
  console.log(`    실제값: ${result.totalCost.toFixed(2)}원`);
  console.log(`    결과: ${Math.abs(result.totalCost - expectedTotalCost) < 0.01 ? '✅' : '❌'}`);
  console.log('');
  console.log('  마진:');
  console.log(`    기대값: ${expectedMargin.toFixed(2)}원`);
  console.log(`    실제값: ${result.margin.toFixed(2)}원`);
  console.log(`    결과: ${Math.abs(result.margin - expectedMargin) < 0.01 ? '✅' : '❌'}`);
  console.log('');
  console.log('  마진율:');
  console.log(`    기대값: ${expectedMarginRate.toFixed(2)}%`);
  console.log(`    실제값: ${result.marginRate.toFixed(2)}%`);
  console.log(`    결과: ${Math.abs(result.marginRate - expectedMarginRate) < 0.01 ? '✅' : '❌'}`);
  console.log('');
  console.log('  손익분기:');
  console.log(`    기대값: ${expectedBreakeven.toFixed(2)}건`);
  console.log(`    실제값: ${result.breakevenUnits?.toFixed(2) || 'null'}건`);
  console.log(`    결과: ${result.breakevenUnits && Math.abs(result.breakevenUnits - expectedBreakeven) < 0.01 ? '✅' : '❌'}`);
  console.log('');

  const allPass =
    Math.abs(result.directLaborCost - expectedDirectLabor) < 0.01 &&
    Math.abs(result.consumableCost - expectedConsumable) < 0.01 &&
    Math.abs(result.fixedCostAllocated - expectedFixedAllocated) < 0.01 &&
    Math.abs(result.totalCost - expectedTotalCost) < 0.01 &&
    Math.abs(result.margin - expectedMargin) < 0.01 &&
    Math.abs(result.marginRate - expectedMarginRate) < 0.01 &&
    result.breakevenUnits !== null &&
    Math.abs(result.breakevenUnits - expectedBreakeven) < 0.01;

  console.log(`  전체 결과: ${allPass ? '✅ PASS' : '❌ FAIL'}\n`);

  return allPass;
}

// PRD 시나리오 5: 고정비 그룹별 합계
function testFixedCostSummary() {
  const fixedCosts: FixedCostItem[] = [
    { id: 'fc1', name: '임대료', monthlyAmount: 3_000_000, costGroup: 'facility' },
    { id: 'fc2', name: '관리비', monthlyAmount: 500_000, costGroup: 'facility' },
    { id: 'fc3', name: '4대보험료', monthlyAmount: 1_200_000, costGroup: 'common' },
    { id: 'fc4', name: '마케팅 비용', monthlyAmount: 1_000_000, costGroup: 'marketing' },
  ];

  const result = summarizeFixedCosts(fixedCosts);

  console.log('✓ Test 5: 고정비 그룹별 합계');
  console.log(`  시설·운영비: ${result.facilityTotal.toLocaleString()}원 (기대: 3,500,000원)`);
  console.log(`  공통비용: ${result.commonTotal.toLocaleString()}원 (기대: 1,200,000원)`);
  console.log(`  마케팅 비용: ${result.marketingTotal.toLocaleString()}원 (기대: 1,000,000원)`);
  console.log(`  전체 합계: ${result.total.toLocaleString()}원 (기대: 5,700,000원)`);

  const allPass =
    result.facilityTotal === 3_500_000 &&
    result.commonTotal === 1_200_000 &&
    result.marketingTotal === 1_000_000 &&
    result.total === 5_700_000;

  console.log(`  결과: ${allPass ? '✅ PASS' : '❌ FAIL'}\n`);

  return allPass;
}

// 전체 테스트 실행
export function runAllVerificationTests() {
  console.log('='.repeat(60));
  console.log('계산 정합성 검증 테스트 시작');
  console.log('='.repeat(60));
  console.log('');

  const results = [
    testOperationalMinutes(),
    testStaffMinuteRate(),
    testMaterialUnitCost(),
    testProcedureBreakdown(),
    testFixedCostSummary(),
  ];

  console.log('='.repeat(60));
  console.log('테스트 결과 요약');
  console.log('='.repeat(60));
  console.log(`총 ${results.length}개 테스트 중 ${results.filter(r => r).length}개 성공`);
  console.log(`결과: ${results.every(r => r) ? '✅ 모든 테스트 통과' : '❌ 일부 테스트 실패'}`);
  console.log('='.repeat(60));

  return results.every(r => r);
}
