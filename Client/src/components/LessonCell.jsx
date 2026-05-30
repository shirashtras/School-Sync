import { Button } from '@mui/material';

export default function LessonCell({ entries, viewMode = 'class', onEdit }) {
  if (!entries?.length) return <span>-</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, direction: 'rtl', textAlign: 'center' }}>
      {entries.map((entry, index) => (
        <div
          key={`${entry.subject}-${entry.teacher}-${entry.className}-${index}`}
          style={{
            border: '1px solid #ddd',
            borderRadius: 4,
            padding: 4,
            backgroundColor: '#fafafa',
            fontSize: '0.85rem',
          }}
        >
          {viewMode === 'teacher' ? (
            <>
              <div><strong>{entry.subject}</strong></div>
              {entry.className && <div>{entry.className}</div>}
            </>
          ) : (
            <>
              <div><strong>{entry.subject}</strong></div>
              {entry.teacher ? <div>{entry.teacher}</div> : null}
            </>
          )}
          {onEdit && (
            <Button size="small" onClick={() => onEdit(entry)} sx={{ mt: 0.5, minWidth: 0 }}>
              עריכה
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
