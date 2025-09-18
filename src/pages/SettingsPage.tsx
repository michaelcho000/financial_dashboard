import React, { useState } from 'react';
import DataTemplateEditor from '../components/DataTemplateEditor';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'dataTemplate' | 'security' | 'notifications'>('dataTemplate');

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