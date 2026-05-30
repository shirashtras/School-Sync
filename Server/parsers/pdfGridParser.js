import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  WEEK_DAYS,
  parseCellContent,
  normalizeClassToken,
} from './cellParser.js';

const DAY_NAMES = new Set(WEEK_DAYS);
const isHourToken = (str) => /^[1-9]$/.test(str);
const isClassHeaderToken = (str) => /^[א-ת]\d+$/.test(str);

const nearest = (value, points) => {
  if (!points.length) return null;
  return points.reduce((best, point) =>
    Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best
  );
};

const mode = (values) => {
  if (!values.length) return null;
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const extractPageItems = (textContent) =>
  textContent.items
    .map((item) => ({
      str: (item.str || '').trim(),
      x: item.transform[4],
      y: item.transform[5],
    }))
    .filter((item) => item.str);

const extractDayFromText = (text) => {
  const match = (text || '').match(/(ראשון|שני|שלישי|רביעי|חמישי|שישי)/);
  return match ? match[1] : null;
};

const detectClassColumns = (items) => {
  const headerY = Math.max(...items.map((i) => i.y));
  const headerItems = items.filter(
    (item) => item.y >= headerY - 15 && isClassHeaderToken(item.str)
  );

  const columns = headerItems
    .map((item) => ({ className: normalizeClassToken(item.str), x: item.x }))
    .filter((col) => col.className);

  const unique = [];
  const seen = new Set();
  columns
    .sort((a, b) => b.x - a.x)
    .forEach((col) => {
      if (seen.has(col.className)) return;
      seen.add(col.className);
      unique.push(col);
    });

  return unique;
};

const buildColumnBoundaries = (classColumns) => {
  const sorted = [...classColumns].sort((a, b) => a.x - b.x);
  return sorted.map((col, index) => {
    const left = index === 0 ? Number.NEGATIVE_INFINITY : (sorted[index - 1].x + col.x) / 2;
    const right = index === sorted.length - 1
      ? Number.POSITIVE_INFINITY
      : (col.x + sorted[index + 1].x) / 2;
    return { ...col, xMin: left, xMax: right };
  });
};

const itemInColumn = (item, column) =>
  item.x > column.xMin && item.x <= column.xMax;

const detectSideColumnX = (items) => {
  const hourItems = items.filter((item) => isHourToken(item.str));
  if (!hourItems.length) return null;
  return Number(mode(hourItems.map((item) => Math.round(item.x))));
};

const detectLayoutType = (items) => {
  const dayCount = items.filter((item) => DAY_NAMES.has(item.str)).length;
  return dayCount >= 4 ? 'compact' : 'grid';
};

const isStructuralItem = (item, classColumns, sideColumnX, layoutType) => {
  if (DAY_NAMES.has(item.str)) return true;
  if (extractDayFromText(item.str) && sideColumnX && Math.abs(item.x - sideColumnX) <= 25) {
    return true;
  }
  if (isClassHeaderToken(item.str) && item.y > 700) return true;
  if (
    isHourToken(item.str) &&
    sideColumnX != null &&
    Math.abs(item.x - sideColumnX) <= 15
  ) {
    return true;
  }
  if (item.str === 'נושא') return true;
  return false;
};

// ── GRID layout (2 days per page, e.g. פריסה 3) ─────────────────

const detectGridDayBlocks = (items) => {
  const dayItems = items.filter((item) => DAY_NAMES.has(item.str));
  if (!dayItems.length) return [];

  const sorted = [...dayItems].sort((a, b) => b.y - a.y);
  const splitY = sorted.length >= 2
    ? (sorted[0].y + sorted[1].y) / 2
    : sorted[0].y;

  return sorted.map((item) => ({
    day: item.str,
    isUpper: item.y >= splitY,
    labelY: item.y,
  }));
};

const detectGridHourRows = (items, classColumns, sideColumnX) => {
  const maxClassX = classColumns.length
    ? Math.max(...classColumns.map((col) => col.x))
    : 0;

  const hourItems = items.filter(
    (item) =>
      isHourToken(item.str) &&
      (sideColumnX == null || Math.abs(item.x - sideColumnX) <= 15) &&
      item.x >= maxClassX - 60
  );

  const unique = [];
  const seen = new Set();
  hourItems
    .sort((a, b) => b.y - a.y)
    .forEach((item) => {
      const key = `${item.str}-${Math.round(item.y / 5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push({ hour: Number(item.str), y: item.y });
    });

  const upper = [];
  const lower = [];
  if (unique.length < 2) return { upper: unique, lower: [] };

  const splitY = (Math.max(...unique.map((h) => h.y)) + Math.min(...unique.map((h) => h.y))) / 2;

  unique.forEach((entry) => {
    if (entry.y >= splitY - 20) upper.push(entry);
    else lower.push(entry);
  });

  return {
    upper: upper.sort((a, b) => b.y - a.y),
    lower: lower.sort((a, b) => b.y - a.y),
  };
};

const assignGridItemMeta = (item, columnBoundaries, dayBlocks, hourRows) => {
  const column = columnBoundaries.find((col) => itemInColumn(item, col));
  if (!column) return null;

  const upperDay = dayBlocks.find((block) => block.isUpper)?.day;
  const lowerDay = dayBlocks.find((block) => !block.isUpper)?.day;

  const upperMid = hourRows.upper.length
    ? hourRows.upper.reduce((sum, row) => sum + row.y, 0) / hourRows.upper.length
    : 500;
  const lowerMid = hourRows.lower.length
    ? hourRows.lower.reduce((sum, row) => sum + row.y, 0) / hourRows.lower.length
    : 200;
  const blockMid = (upperMid + lowerMid) / 2;

  const isUpper = item.y >= blockMid;
  const day = isUpper ? upperDay : lowerDay;
  const hourSet = isUpper ? hourRows.upper : hourRows.lower;

  const hourPoint = nearest(
    item.y,
    hourSet.map((row) => ({ value: row.y, hour: row.hour }))
  );

  if (!day || !hourPoint) return null;

  return {
    className: column.className,
    day,
    hour: hourPoint.hour,
  };
};

const buildCellsGridLayout = (items) => {
  const classColumns = detectClassColumns(items);
  if (classColumns.length < 2) return { cells: [], allowedClasses: new Set() };

  const columnBoundaries = buildColumnBoundaries(classColumns);
  const dayBlocks = detectGridDayBlocks(items);
  const sideColumnX = detectSideColumnX(items);
  const hourRows = detectGridHourRows(items, classColumns, sideColumnX);

  if (!dayBlocks.length || (!hourRows.upper.length && !hourRows.lower.length)) {
    return { cells: [], allowedClasses: new Set() };
  }

  const allowedClasses = new Set(classColumns.map((col) => col.className));
  const cells = new Map();

  items.forEach((item) => {
    if (isStructuralItem(item, classColumns, sideColumnX, 'grid')) return;

    const meta = assignGridItemMeta(item, columnBoundaries, dayBlocks, hourRows);
    if (!meta) return;

    const key = `${meta.className}|${meta.day}|${meta.hour}`;
    if (!cells.has(key)) {
      cells.set(key, { ...meta, parts: [] });
    }
    cells.get(key).parts.push(item);
  });

  return {
    cells: Array.from(cells.values()).map((cell) => ({
      className: cell.className,
      day: cell.day,
      hour: cell.hour,
      text: cell.parts
        .sort((a, b) => b.y - a.y)
        .map((part) => part.str)
        .join('\n')
        .trim(),
    })),
    allowedClasses,
  };
};

// ── COMPACT layout (many days on one page, e.g. שחור לבן) ─────────

const detectCompactDayBlocks = (items, sideColumnX) => {
  const hourMarkers = items
    .filter(
      (item) =>
        isHourToken(item.str) &&
        sideColumnX != null &&
        Math.abs(item.x - sideColumnX) <= 15
    )
    .sort((a, b) => b.y - a.y);

  if (!hourMarkers.length) return [];

  const groups = [];
  let current = [];

  hourMarkers.forEach((marker) => {
    const hour = Number(marker.str);
    if (hour === 1 && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push({ hour, y: marker.y });
  });
  if (current.length) groups.push(current);

  const dayLabelItems = items
    .filter((item) => DAY_NAMES.has(item.str))
    .sort((a, b) => b.y - a.y);

  return groups.map((hourRows, index) => {
    const sortedRows = [...hourRows].sort((a, b) => b.y - a.y);
    const yMax = Math.max(...sortedRows.map((row) => row.y));
    const yMin = Math.min(...sortedRows.map((row) => row.y));

    const dayInBlock = dayLabelItems.find(
      (label) => label.y <= yMax + 5 && label.y >= yMin - 5
    );
    const fallbackDay = dayLabelItems[index];

    const prevBlock = index > 0 ? groups[index - 1] : null;
    const nextBlock = index < groups.length - 1 ? groups[index + 1] : null;
    const blockTop = prevBlock
      ? (Math.min(...prevBlock.map((r) => r.y)) + yMax) / 2
      : yMax + 20;
    const blockBottom = nextBlock
      ? (yMin + Math.max(...nextBlock.map((r) => r.y))) / 2
      : yMin - 20;

    return {
      day: dayInBlock?.str || fallbackDay?.str || WEEK_DAYS[index] || WEEK_DAYS[0],
      yMin: blockBottom,
      yMax: blockTop,
      hourRows: sortedRows.map((row, rowIndex) => ({
        hour: rowIndex + 1,
        y: row.y,
      })),
    };
  });
};

const assignCompactItemToHour = (itemY, hourRows) => {
  const sorted = [...hourRows].sort((a, b) => b.y - a.y);
  if (!sorted.length) return null;

  for (let index = 0; index < sorted.length; index += 1) {
    const upperBound = index === 0
      ? Number.POSITIVE_INFINITY
      : (sorted[index - 1].y + sorted[index].y) / 2;
    const lowerBound = index === sorted.length - 1
      ? Number.NEGATIVE_INFINITY
      : (sorted[index].y + sorted[index + 1].y) / 2;

    if (itemY <= upperBound && itemY > lowerBound) {
      return sorted[index].hour;
    }
  }

  return sorted[sorted.length - 1].hour;
};

const buildCellsCompactLayout = (items) => {
  const classColumns = detectClassColumns(items);
  if (classColumns.length < 2) return { cells: [], allowedClasses: new Set() };

  const columnBoundaries = buildColumnBoundaries(classColumns);
  const sideColumnX = detectSideColumnX(items);
  const dayBlocks = detectCompactDayBlocks(items, sideColumnX);

  if (!dayBlocks.length) return { cells: [], allowedClasses: new Set() };

  const allowedClasses = new Set(classColumns.map((col) => col.className));
  const cells = new Map();

  dayBlocks.forEach((block) => {
    columnBoundaries.forEach((column) => {
      const colItems = items.filter(
        (item) =>
          !isStructuralItem(item, classColumns, sideColumnX, 'compact') &&
          itemInColumn(item, column) &&
          item.y >= block.yMin &&
          item.y <= block.yMax
      );

      const hourBuckets = new Map();
      block.hourRows.forEach((row) => hourBuckets.set(row.hour, []));

      colItems.forEach((item) => {
        const hour = assignCompactItemToHour(item.y, block.hourRows);
        if (!hour || !hourBuckets.has(hour)) return;
        hourBuckets.get(hour).push(item);
      });

      hourBuckets.forEach((parts, hour) => {
        const text = parts
          .sort((a, b) => b.y - a.y)
          .map((part) => part.str)
          .join('\n')
          .trim();

        if (!text) return;

        const key = `${column.className}|${block.day}|${hour}`;
        cells.set(key, {
          className: column.className,
          day: block.day,
          hour,
          text,
        });
      });
    });
  });

  return { cells: Array.from(cells.values()), allowedClasses };
};

const buildCellsFromPage = (items) => {
  const layoutType = detectLayoutType(items);
  if (layoutType === 'compact') {
    return buildCellsCompactLayout(items);
  }
  return buildCellsGridLayout(items);
};

export const parsePdfFile = async (filePath) => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const lessons = [];
  let allowedClasses = new Set();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = extractPageItems(content);
    const { cells, allowedClasses: pageClasses } = buildCellsFromPage(items);

    pageClasses.forEach((className) => allowedClasses.add(className));

    cells.forEach((cell) => {
      if (!cell.text) return;
      const parsed = parseCellContent(
        cell.text,
        cell.className,
        cell.day,
        cell.hour,
        allowedClasses
      );
      lessons.push(...parsed);
    });
  }

  return dedupeLessons(lessons);
};

const dedupeLessons = (lessons) => {
  const seen = new Set();
  return lessons.filter((lesson) => {
    const key = [
      lesson.className,
      lesson.day,
      lesson.hour,
      lesson.subject,
      lesson.teacher || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const parsePdfText = () => [];
