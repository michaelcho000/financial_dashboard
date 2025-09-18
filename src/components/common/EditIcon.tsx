

import React from 'react';

export const EditIcon: React.FC<{ onClick: () => void; className?: string }> = ({ onClick, className = "" }) => (
  <svg onClick={onClick}
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`cursor-pointer text-gray-400 hover:text-blue-600 ml-2 ${className}`}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
);