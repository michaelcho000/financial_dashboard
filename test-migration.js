// 구버전 데이터 샘플 (마이그레이션 테스트용)
const legacyData = {
  "financial_app_db": JSON.stringify({
    users: [
      { id: 'superadmin', password: 'adminpass', name: 'Super Admin', email: 'admin@system.com', role: 'superAdmin' },
      { id: 'user1', password: 'userpass', name: '김담당', email: 'user1@hospital.com', role: 'generalAdmin', tenantIds: ['tenant-1'] }
    ],
    tenants: [
      { id: 'tenant-1', name: '강남 A 피부과' },
      { id: 'tenant-2', name: '부산 B 의원' }
    ],
    financialData: {
      'tenant-1': {
        // templateVersion 없음 (구버전)
        accounts: {
          revenue: [
            { id: 'rev-1', name: '카드매출', category: 'REVENUE', group: '비급여', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-2', name: '현금매출', category: 'REVENUE', group: '비급여', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-4', name: '본인부담금', category: 'REVENUE', group: '보험급여', isDeletable: true, entryType: 'transaction' }
          ],
          cogs: [
            { id: 'cogs-1', name: '재료비 A', category: 'COGS', group: '원재료비', isDeletable: true, entryType: 'transaction' }
          ],
          sgaFixed: [
            { id: 'sga-fix-1', name: '직원급여', category: 'SGA_FIXED', group: '인건비', isDeletable: false, entryType: 'manual' },
            { id: 'sga-fix-2', name: '4대보험', category: 'SGA_FIXED', group: '인건비', isDeletable: false, entryType: 'manual' },
            { id: 'sga-fix-3', name: '월 임차료', category: 'SGA_FIXED', group: '지급임차료', isDeletable: false, entryType: 'manual' }
          ],
          sgaVariable: [
            { id: 'sga-var-1', name: '복리후생비', category: 'SGA_VARIABLE', group: '인건비', isDeletable: false, entryType: 'transaction' },
            { id: 'sga-var-2', name: '마케팅비', category: 'SGA_VARIABLE', group: '기타', isDeletable: true, entryType: 'transaction' }
          ]
        },
        accountGroups: {
          revenue: ['비급여', '보험급여'],
          cogs: ['원재료비'],
          sga: ['인건비', '지급임차료', '기타']
        },
        transactionData: {
          '2025-08': {
            'rev-1': [{ id: 't-rev-1', description: '8월 카드 매출', amount: 250000000 }],
            'cogs-1': [{ id: 't-cogs-1', description: 'A업체 발주', amount: 13100000 }]
          }
        },
        manualData: {},
        fixedCostLedger: [
          { id: 'fcl-1', accountId: 'sga-fix-1', costType: 'OPERATING_SERVICE', serviceName: '직원급여', vendor: '내부', monthlyCost: 80000000, paymentDate: '매월 10일' },
          { id: 'fcl-2', accountId: 'sga-fix-2', costType: 'OPERATING_SERVICE', serviceName: '4대보험', vendor: '정부', monthlyCost: 12000000, paymentDate: '매월 10일' },
          { id: 'fcl-3', accountId: 'sga-fix-3', costType: 'OPERATING_SERVICE', serviceName: '월 임차료', vendor: '건물주', monthlyCost: 15000000, paymentDate: '매월 1일' }
        ]
      },
      'tenant-2': {
        // templateVersion 없음 (구버전)
        accounts: {
          revenue: [
            { id: 'rev-1', name: '카드매출', category: 'REVENUE', group: '비급여', isDeletable: true, entryType: 'transaction' },
            { id: 'rev-2', name: '현금매출', category: 'REVENUE', group: '비급여', isDeletable: true, entryType: 'transaction' }
          ],
          cogs: [
            { id: 'cogs-1', name: '재료비 A', category: 'COGS', group: '원재료비', isDeletable: true, entryType: 'transaction' }
          ],
          sgaFixed: [
            { id: 'sga-fix-1', name: '직원급여', category: 'SGA_FIXED', group: '인건비', isDeletable: false, entryType: 'manual' }
          ],
          sgaVariable: []
        },
        accountGroups: {
          revenue: ['비급여', '보험급여'],
          cogs: ['원재료비'],
          sga: ['인건비', '지급임차료', '기타']
        },
        transactionData: {},
        manualData: {},
        fixedCostLedger: []
      }
    }
  })
};

console.log('=== 구버전 데이터 샘플 ===');
console.log('브라우저 콘솔에서 실행:');
console.log('localStorage.clear();');
Object.keys(legacyData).forEach(key => {
  console.log(`localStorage.setItem('${key}', \`${legacyData[key]}\`);`);
});
console.log('window.location.reload();');