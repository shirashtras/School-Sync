import React from 'react';

const ScheduleCell = ({ entries }) => {
  if (!entries || entries.length === 0) {
    return <span>-</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {entries.map((entry, index) => (
        <div key={index} style={{ border: '1px solid #ccc', padding: '4px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
          <div><strong>{entry.subject}</strong></div>
          <div style={{ fontSize: '0.8em' }}>{entry.teacher}</div>
          <div style={{ fontSize: '0.8em' }}>{entry.group}</div>
        </div>
      ))}
    </div>
  );
};

export default ScheduleCell;