

import React from 'react';

interface HeaderProps {
    title: string;
    description: string;
    showMonthSelector?: boolean;
    actions?: React.ReactNode;
    currentMonths: [string, string | null];
    setCurrentMonths: React.Dispatch<React.SetStateAction<[string, string | null]>>;
    onStartMonthChange?: (nextMonth: string) => boolean | void;
    onEndMonthChange?: (nextMonth: string | null) => boolean | void;
}

const Header: React.FC<HeaderProps> = ({
    title,
    description,
    showMonthSelector = false,
    actions,
    currentMonths,
    setCurrentMonths,
    onStartMonthChange,
    onEndMonthChange,
}) => {
    const [startMonth, endMonth] = currentMonths;

    const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = e.target.value;
        const allowUpdate = onStartMonthChange ? onStartMonthChange(nextValue) : true;
        if (allowUpdate !== false) {
            setCurrentMonths([nextValue, endMonth]);
        }
    };

    const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = e.target.value;
        const normalized = nextValue ? nextValue : null;
        const allowUpdate = onEndMonthChange ? onEndMonthChange(normalized) : true;
        if (allowUpdate !== false) {
            setCurrentMonths([startMonth, normalized]);
        }
    };

    const showComparison = () => {
        if (!startMonth) return;
        const [year, month] = startMonth.split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = (prevDate.getMonth() + 1).toString().padStart(2, '0');
        const nextEnd = `${prevYear}-${prevMonth}`;
        const allowUpdate = onEndMonthChange ? onEndMonthChange(nextEnd) : true;
        if (allowUpdate !== false) {
            setCurrentMonths([startMonth, nextEnd]);
        }
    };

    const hideComparison = () => {
        const allowUpdate = onEndMonthChange ? onEndMonthChange(null) : true;
        if (allowUpdate !== false) {
            setCurrentMonths([startMonth, null]);
        }
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
