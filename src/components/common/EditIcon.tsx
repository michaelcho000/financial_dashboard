import React from 'react';

interface EditIconProps {
  onClick?: () => void;
  className?: string;
}

export const EditIcon: React.FC<EditIconProps> = ({ onClick, className = '' }) => (
  <svg
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${onClick ? 'cursor-pointer text-gray-400 hover:text-blue-600' : 'text-gray-400'} ml-2 ${className}`}
  >
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
);
