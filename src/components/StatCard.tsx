import React from 'react';

interface CardProps {
  label: string;
  value: string | number;
  color?: string;
}

export const StatCard: React.FC<CardProps> = ({ label, value, color }) => {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value" style={color ? { color } : {}}>{value}</div>
    </div>
  );
};
