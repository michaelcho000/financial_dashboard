import React, { useState } from 'react';
import DataTemplateEditor from '../components/DataTemplateEditor';
import DatabaseService from '../services/DatabaseService';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'dataTemplate' | 'security' | 'notifications'>('dataTemplate');
  const [migrationResults, setMigrationResults] = useState<any>(null);
  const [isRunningMigration, setIsRunningMigration] = useState(false);

  const runDataMigration = async () => {
    setIsRunningMigration(true);
    try {
      const results = DatabaseService.runManualMigration();
      setMigrationResults(results);
      alert(`마이그레이션 완료: ${results.success}개 성공, ${results.failed}개 실패`);
    } catch (error) {
      console.error('Migration failed:', error);
      alert('마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setIsRunningMigration(false);
    }
  };

  const tabs = [
    { id: 'general' as const, label: '일반', disabled: true },
    { id: 'dataTemplate' as const, label: '데이터 템플릿', disabled: false },
    { id: 'security' as const, label: '보안', disabled: true },
    { id: 'notifications' as const, label: '알림', disabled: true }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">시스템 설정</h1>
        <p className="text-gray-600">시스템 전체 설정을 관리합니다</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : tab.disabled
                  ? 'border-transparent text-gray-400 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={tab.disabled}
            >
              {tab.label}
              {tab.disabled && ' (준비중)'}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {activeTab === 'general' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">일반 설정</h3>
            <p className="text-gray-500">일반 설정 기능은 준비 중입니다.</p>
          </div>
        )}

        {activeTab === 'dataTemplate' && (
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">데이터 템플릿 관리</h3>
              <p className="text-gray-600 mb-4">
                신규 병원 생성 시 사용할 기본 계정과목, 그룹, 고정비 템플릿을 설정합니다.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">주의사항</h4>
                    <div className="mt-1 text-sm text-yellow-700">
                      <p>• 템플릿 변경사항은 신규 생성되는 병원에만 적용됩니다</p>
                      <p>• 기존 병원의 데이터는 영향을 받지 않습니다</p>
                      <p>• 변경 전 현재 설정을 백업해두시기 바랍니다</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DataTemplateEditor />

            {/* 마이그레이션 관리 섹션 */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-lg font-medium mb-4">기존 병원 데이터 마이그레이션</h4>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h5 className="text-sm font-medium text-amber-800">기존 병원 데이터 업데이트</h5>
                    <div className="mt-1 text-sm text-amber-700">
                      <p>템플릿을 변경한 후, 기존 병원들의 계정 구조를 새 템플릿에 맞춰 업데이트할 수 있습니다.</p>
                      <p>마이그레이션 전 자동으로 백업이 생성되므로 안전합니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 mb-4">
                <button
                  onClick={runDataMigration}
                  disabled={isRunningMigration}
                  className={`px-4 py-2 text-sm text-white rounded-md ${
                    isRunningMigration
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {isRunningMigration ? '마이그레이션 실행 중...' : '기존 병원 데이터 마이그레이션 실행'}
                </button>
              </div>

              {/* 마이그레이션 결과 표시 */}
              {migrationResults && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h5 className="font-medium mb-2">마이그레이션 결과</h5>
                  <div className="text-sm text-gray-600">
                    <p>성공: {migrationResults.success}개, 실패: {migrationResults.failed}개</p>
                    {migrationResults.results.length > 0 && (
                      <div className="mt-2">
                        <h6 className="font-medium">세부 결과:</h6>
                        <ul className="mt-1 space-y-1">
                          {migrationResults.results.map((result: any, index: number) => (
                            <li key={index} className="flex items-center">
                              <span className={`mr-2 ${
                                result.status === 'failed' ? 'text-red-500' :
                                result.status === 'migrated' ? 'text-green-500' : 'text-gray-500'
                              }`}>
                                {result.status === 'failed' ? '❌' :
                                 result.status === 'migrated' ? '✅' : 'ℹ️'}
                              </span>
                              <span>{result.tenantId}: {result.status}</span>
                              {result.error && <span className="ml-2 text-red-500">({result.error})</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">보안 설정</h3>
            <p className="text-gray-500">보안 설정 기능은 준비 중입니다.</p>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">알림 설정</h3>
            <p className="text-gray-500">알림 설정 기능은 준비 중입니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;