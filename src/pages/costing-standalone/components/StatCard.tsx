import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  variant?: 'default' | 'info' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'border-gray-200 bg-gray-50',
    info: 'border-blue-200 bg-blue-50',
    warning: 'border-amber-200 bg-amber-50',
  };

  const textClasses = {
    default: 'text-gray-500',
    info: 'text-blue-600',
    warning: 'text-amber-600',
  };

  return (
    <div className={`rounded-md border p-4 text-sm ${variantClasses[variant]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${textClasses[variant]}`}>
        {title}
      </p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
};

export default StatCard;
