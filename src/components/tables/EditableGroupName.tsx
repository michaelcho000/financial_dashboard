


import React, { useEffect, useRef, useState } from 'react';
import { EditIcon } from '../common/EditIcon';
import { useFinancials } from '../../contexts/FinancialDataContext';

export const EditableGroupName: React.FC<{
  groupName: string;
  type: 'revenue' | 'expense';
}> = ({
  groupName,
  type,
}) => {
  const { variable } = useFinancials();
  const { updateGroupName } = variable;
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(groupName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setName(groupName);
  }, [groupName]);

  const handleUpdate = () => {
    if (name.trim() && name !== groupName) {
      updateGroupName(groupName, name.trim(), type);
    }
    setIsEditing(false);
  };

  return (
      <div className="flex items-center group">
        {isEditing ? (
          <input ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            className="w-full text-base font-semibold text-gray-800 bg-white border border-blue-400 rounded px-2 py-1 focus:outline-none"
          />
        ) : (
          <>
            <span>{groupName}</span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <EditIcon onClick={() => setIsEditing(true)} />
            </div>
          </>
        )}
      </div>
  );
};
