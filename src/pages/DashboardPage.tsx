import React from 'react';
import { useFinancials } from '../contexts/FinancialDataContext';
import { formatCurrency } from '../utils/formatters';
import { DollarSignIcon } from '../components/icons/DollarSignIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { TrendingDownIcon } from '../components/icons/TrendingDownIcon';
import MonthlyTrendChart from '../components/charts/MonthlyTrendChart';
import Header from '../components/Header';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; isNegative?: boolean; }> = ({ title, value, icon, isNegative = false }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center">
            <div className="p-3 rounded-full bg-slate-100 text-slate-600">
                {icon}
            </div>
            <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
            </div>
        </div>
    </div>
);

const DashboardPage: React.FC = () => {
    const { currentUser, currentTenant, statement, currentMonths, setCurrentMonths } = useFinancials();
    const { calculatedData } = statement;
    const [currentMonth] = currentMonths;
    const data = currentMonth ? calculatedData[currentMonth] : null;

    if (!currentUser || !currentTenant) {
        return <div>Loading...</div>;
    }
    
    const grossProfitValue = data?.grossProfit ?? 0;
    const operatingProfitValue = data?.operatingProfit ?? 0;
    const isGrossProfitNegative = grossProfitValue < 0;
    const isOperatingProfitNegative = operatingProfitValue < 0;

    return (
        <>
            <Header
                title={`안녕하세요, ${currentUser.name}님!`}
                description={`${currentTenant.name}의 대시보드입니다.`}
                showMonthSelector={true}
                currentMonths={currentMonths}
                setCurrentMonths={setCurrentMonths}
            />
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="총 매출"
                    value={formatCurrency(data?.revenue || 0)}
                    icon={<DollarSignIcon />}
                />
                 <StatCard 
                    title="매출총이익"
                    value={formatCurrency(grossProfitValue, { alwaysParentheses: isGrossProfitNegative })}
                    icon={isGrossProfitNegative ? <TrendingDownIcon /> : <TrendingUpIcon />}
                    isNegative={isGrossProfitNegative}
                />
                 <StatCard 
                    title="총 판매관리비"
                    value={formatCurrency(data?.totalSga || 0, { alwaysParentheses: true })}
                    icon={<TrendingDownIcon />}
                    isNegative
                />
                <StatCard 
                    title="영업이익"
                    value={formatCurrency(operatingProfitValue, { alwaysParentheses: isOperatingProfitNegative })}
                    icon={isOperatingProfitNegative ? <TrendingDownIcon /> : <TrendingUpIcon />}
                    isNegative={isOperatingProfitNegative}
                />
            </div>
            
            <div className="mt-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">월별 손익 추이</h3>
                <div className="h-96">
                   <MonthlyTrendChart data={calculatedData} />
                </div>
              </div>
            </div>
        </>
    );
};

export default DashboardPage;
