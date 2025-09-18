

import React from 'react';

interface HeaderProps {
    title: string;
    description: string;
    showMonthSelector?: boolean;
    actions?: React.ReactNode;
    currentMonths: [string, string | null];
    setCurrentMonths: React.Dispatch<React.SetStateAction<[string, string | null]>>;
}

const Header: React.FC<HeaderProps> = ({ title, description, showMonthSelector = false, actions, currentMonths, setCurrentMonths }) => {
    const [startMonth, endMonth] = currentMonths;

    const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentMonths([e.target.value, endMonth]);
    };

    const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentMonths([startMonth, e.target.value]);
    };

    const showComparison = () => {
        if (!startMonth) return;
        const [year, month] = startMonth.split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = (prevDate.getMonth() + 1).toString().padStart(2, '0');
        setCurrentMonths([startMonth, `${prevYear}-${prevMonth}`]);
    };

    const hideComparison = () => {
        setCurrentMonths([startMonth, null]);
    };
    
    return (
        <header>
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="text-base text-gray-500 mt-1">{description}</p>
                </div>
                {actions && <div className="flex-shrink-0">{actions}</div>}
            </div>
            
            {showMonthSelector && (
                 <div className="flex items-center mt-6">
                    <div className="flex items-center space-x-2">
                         <input type="month" value={startMonth || ''} onChange={handleStartMonthChange} className="border border-gray-300 rounded-md p-2 text-base" />
                         {endMonth ? (
                            <>
                                <span>→</span>
                                <input type="month" value={endMonth} onChange={handleEndMonthChange} className="border border-gray-300 rounded-md p-2 text-base" />
                                <button onClick={hideComparison} className="text-gray-500 hover:text-red-600 font-bold text-xl px-2">&times;</button>
                            </>
                         ) : (
                            <button onClick={showComparison} className="px-3 py-2 text-sm text-blue-600 border border-gray-300 rounded-md hover:bg-gray-100">
                                + 비교
                            </button>
                         )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;