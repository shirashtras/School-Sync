import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  WEEK_DAYS,
  parseCellContent,
  normalizeClassToken,
  isClassNameToken,
  SUBJECT_KEYWORDS,
} from './cellParser.js';

const DAY_NAMES = new Set(WEEK_DAYS);
const parseHourToken = (str) => {
  const text = (str || '').toString().trim();
  if (/^[1-9]$/.test(text)) return { hour: Number(text), duration: 1 };
  const doubleMatch = text.match(/^(\d)\s+(\d)$/);
  if (doubleMatch) {
    return { hour: Number(doubleMatch[1]), duration: 2 };
  }
  const tripleMatch = text.match(/^(\d)\s+(\d)\s+(\d)$/);
  if (tripleMatch) {
    return { hour: Number(tripleMatch[1]), duration: 3 };
  }
  return null;
};
const isHourToken = (str) => parseHourToken(str) != null;
const hourTokenValue = (str) => parseHourToken(str)?.hour;
const isClassHeaderToken = (str) => isClassNameToken(str);

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

const extractDayLabels = (items) =>
  items
    .map((item) => {
      if (DAY_NAMES.has(item.str)) return { ...item, day: item.str };
      const day = extractDayFromText(item.str);
      return day ? { ...item, day } : null;
    })
    .filter(Boolean);

const detectClassColumns = (items) => {
  const headerY = Math.max(...items.map((i) => i.y));
  const headerItems = items.filter(
    (item) => item.y >= headerY - 15 && isClassHeaderToken(item.str)
  );

  const columns = headerItems
    .map((item) => ({ className: normalizeClassToken(item.str), x: item.x, raw: item.str }))
    .filter((col) => col.className && isClassNameToken(col.className));

  const unique = [];
  const seen = new Set();
  columns
    .sort((a, b) => b.x - a.x)
    .forEach((col) => {
      if (seen.has(col.className)) return;
      seen.add(col.className);
      unique.push({ className: col.className, x: col.x });
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
  const dayCount = extractDayLabels(items).length;
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
  const dayItems = extractDayLabels(items);
  if (!dayItems.length) return [];

  const sorted = [...dayItems].sort((a, b) => b.y - a.y);

  return sorted.map((item, index) => {
    const yTop = index === 0
      ? Number.POSITIVE_INFINITY
      : (sorted[index - 1].y + item.y) / 2;
    const yBottom = index === sorted.length - 1
      ? Number.NEGATIVE_INFINITY
      : (item.y + sorted[index + 1].y) / 2;

    return {
      day: item.day,
      yMin: yBottom,
      yMax: yTop,
      labelY: item.y,
    };
  });
};

const detectHourRowsInBand = (items, yMin, yMax, classColumns, sideColumnX) => {
  const maxClassX = classColumns.length
    ? Math.max(...classColumns.map((col) => col.x))
    : 0;

  const hourItems = items.filter(
    (item) =>
      isHourToken(item.str) &&
      item.y >= yMin &&
      item.y <= yMax &&
      (sideColumnX == null || Math.abs(item.x - sideColumnX) <= 15) &&
      item.x >= maxClassX - 60
  );

  const unique = [];
  const seen = new Set();
  hourItems
    .sort((a, b) => b.y - a.y)
    .forEach((item) => {
      const key = Math.round(item.y / 4);
      if (seen.has(key)) return;
      seen.add(key);
      const span = /^\d\s+\d$/.test(item.str) ? 2 : (/^\d\s+\d\s+\d$/.test(item.str) ? 3 : 1);
      unique.push({ y: item.y, span });
    });

  return unique
    .sort((a, b) => b.y - a.y)
    .map((row, index) => ({
      hour: index + 1,
      y: row.y,
      duration: row.span || 1,
    }));
};

const assignItemToHourRow = (itemY, hourRows) => {
  const sorted = [...hourRows].sort((a, b) => b.y - a.y);
  if (!sorted.length) return null;

  let bestHour = sorted[0].hour;
  let bestDistance = Math.abs(itemY - sorted[0].y);

  sorted.forEach((row) => {
    const distance = Math.abs(itemY - row.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestHour = row.hour;
    }
  });

  return bestHour;
};

const assignGridItemMeta = (item, columnBoundaries, dayBlocks, hourRowsByDay) => {
  const column = columnBoundaries.find((col) => itemInColumn(item, col));
  if (!column) return null;

  const dayBlock = dayBlocks.find(
    (block) => item.y >= block.yMin && item.y <= block.yMax
  );
  if (!dayBlock) return null;

  const hourRows = hourRowsByDay.get(dayBlock.day) || [];
  const hour = assignItemToHourRow(item.y, hourRows);

  if (!hour) return null;

  return {
    className: column.className,
    day: dayBlock.day,
    hour,
  };
};

const buildCellsGridLayout = (items) => {
  const classColumns = detectClassColumns(items);
  if (classColumns.length < 2) return { cells: [], allowedClasses: new Set() };

  const columnBoundaries = buildColumnBoundaries(classColumns);
  const dayBlocks = detectGridDayBlocks(items);
  const sideColumnX = detectSideColumnX(items);

  const hourRowsByDay = new Map();
  dayBlocks.forEach((block) => {
    hourRowsByDay.set(
      block.day,
      detectHourRowsInBand(items, block.yMin, block.yMax, classColumns, sideColumnX)
    );
  });

  if (!dayBlocks.length || [...hourRowsByDay.values()].every((rows) => !rows.length)) {
    return { cells: [], allowedClasses: new Set() };
  }

  const allowedClasses = new Set(classColumns.map((col) => col.className));
  const cells = new Map();

  items.forEach((item) => {
    if (isStructuralItem(item, classColumns, sideColumnX, 'grid')) return;

    const meta = assignGridItemMeta(item, columnBoundaries, dayBlocks, hourRowsByDay);
    if (!meta) return;

    const hourRows = hourRowsByDay.get(meta.day) || [];
    const rowMeta = hourRows.find((row) => row.hour === meta.hour);
    const span = rowMeta?.duration || rowMeta?.span || 1;

    for (let offset = 0; offset < span; offset += 1) {
      const hour = meta.hour + offset;
      const key = `${meta.className}|${meta.day}|${hour}`;
      if (!cells.has(key)) {
        cells.set(key, { ...meta, hour, parts: [], span });
      }
      cells.get(key).parts.push(item);
    }
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
      span: cell.span || cell.duration || 1,
      duration: cell.duration || cell.span || 1,
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
    const parsed = parseHourToken(marker.str);
    if (!parsed) return;
    if (parsed.hour === 1 && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push({ hour: parsed.hour, duration: parsed.duration, y: marker.y });
  });
  if (current.length) groups.push(current);

  const dayLabelItems = extractDayLabels(items).sort((a, b) => b.y - a.y);

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
      day: dayInBlock?.day || fallbackDay?.day || WEEK_DAYS[index] || WEEK_DAYS[0],
      yMin: blockBottom,
      yMax: blockTop,
      hourRows: sortedRows.map((row) => ({
        hour: row.hour,
        y: row.y,
        duration: row.duration || 1,
      })),
    };
  });
};

const getHourBand = (hourRows, index) => {
  const sorted = [...hourRows].sort((a, b) => b.y - a.y);
  const row = sorted[index];
  const upperBound = index === 0
    ? Number.POSITIVE_INFINITY
    : (sorted[index - 1].y + row.y) / 2;
  const lowerBound = index === sorted.length - 1
    ? Number.NEGATIVE_INFINITY
    : (row.y + sorted[index + 1].y) / 2;
  return { hour: row.hour, upperBound, lowerBound };
};

const clusterCenterY = (cluster) => {
  const yValues = cluster.map((item) => item.y);
  return (Math.min(...yValues) + Math.max(...yValues)) / 2;
};

const hoursOverlappedByCluster = (cluster, hourRows) => {
  const yMin = Math.min(...cluster.map((item) => item.y));
  const yMax = Math.max(...cluster.map((item) => item.y));
  const centerY = (yMin + yMax) / 2;
  const hours = new Set();

  hourRows.forEach((row, index) => {
    const band = getHourBand(hourRows, index);
    const centerInBand = centerY <= band.upperBound && centerY > band.lowerBound;
    if (centerInBand) hours.add(row.hour);
  });

  return [...hours].sort((a, b) => a - b);
};

const clusterColumnItems = (colItems, gapThreshold = 22) => {
  const sorted = [...colItems].sort((a, b) => b.y - a.y);
  const clusters = [];
  let current = [];

  sorted.forEach((item) => {
    if (!current.length) {
      current.push(item);
      return;
    }
    const lastY = current[current.length - 1].y;
    if (lastY - item.y <= gapThreshold) {
      current.push(item);
      return;
    }
    clusters.push(current);
    current = [item];
  });

  if (current.length) clusters.push(current);
  return clusters;
};

const buildClusterText = (cluster) =>
  cluster
    .sort((a, b) => b.y - a.y)
    .map((part) => part.str)
    .join('\n')
    .trim();

const stripLeadingTeacherLines = (text) => {
  const lines = (text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const subjectIndex = lines.findIndex((line) => {
    if (SUBJECT_KEYWORDS.some((keyword) => line.includes(keyword))) return true;
    const parsed = parseCellContent(line, 'א1', 'ראשון', 1, null);
    return parsed.length === 1 && parsed[0].subject && !parsed[0].teacher;
  });
  if (subjectIndex > 0) return lines.slice(subjectIndex).join('\n');
  return text;
};

const parseCellText = (text, className, day, hour, allowedClasses) => {
  if (!text) return [];
  return parseCellContent(text, className, day, hour, allowedClasses);
};

const detectSubjectTemplateRows = (items) => {
  const headerY = Math.max(...items.map((item) => item.y));
  const templateY = new Set();

  const nearHeader = items.filter(
    (item) => item.y >= headerY - 20 && item.y < headerY - 2
  );
  const groups = new Map();
  nearHeader.forEach((item) => {
    const key = Math.round(item.y);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  groups.forEach((group, yKey) => {
    const subjectLike = group.filter(
      (item) =>
        SUBJECT_KEYWORDS.includes(item.str) ||
        item.str === 'נושא' ||
        item.str === 'מקצוע'
    );
    if (subjectLike.length >= 5) templateY.add(yKey);
  });

  return templateY;
};

const isTemplateRowItem = (item, templateY) =>
  templateY.has(Math.round(item.y));

const isTeacherOnlyText = (text) => {
  const lines = (text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return false;
  return lines.every((line) => {
    const parsed = parseCellContent(line, 'א1', 'ראשון', 1, null);
    return parsed.length === 1 && parsed[0].teacher && !parsed[0].subject;
  });
};

const buildCellsCompactLayout = (items) => {
  const classColumns = detectClassColumns(items);
  if (classColumns.length < 2) return { cells: [], allowedClasses: new Set() };

  const columnBoundaries = buildColumnBoundaries(classColumns);
  const sideColumnX = detectSideColumnX(items);
  const dayBlocks = detectCompactDayBlocks(items, sideColumnX);

  if (!dayBlocks.length) return { cells: [], allowedClasses: new Set() };

  const allowedClasses = new Set(classColumns.map((col) => col.className));
  const cells = [];
  const templateY = detectSubjectTemplateRows(items);

  const pushCell = (cell) => {
    cells.push(cell);
  };

  dayBlocks.forEach((block) => {
    columnBoundaries.forEach((column) => {
      const colItems = items.filter(
        (item) =>
          !isStructuralItem(item, classColumns, sideColumnX, 'compact') &&
          !isTemplateRowItem(item, templateY) &&
          itemInColumn(item, column) &&
          item.y >= block.yMin &&
          item.y <= block.yMax
      );

      const hourBuckets = new Map();
      block.hourRows.forEach((row) => hourBuckets.set(row.hour, []));

      colItems.forEach((item) => {
        const hour = assignItemToHourRow(item.y, block.hourRows);
        if (!hour || !hourBuckets.has(hour)) return;
        hourBuckets.get(hour).push(item);
      });

      const templateSubject = items.find(
        (item) =>
          itemInColumn(item, column) &&
          isTemplateRowItem(item, templateY) &&
          SUBJECT_KEYWORDS.includes(item.str)
      );
      const hourOneBand = getHourBand(block.hourRows, 0);
      const lessonRowHasSubject = colItems.some(
        (item) =>
          templateSubject &&
          item.y < templateSubject.y - 4 &&
          item.y > hourOneBand.lowerBound &&
          item.y <= hourOneBand.upperBound &&
          SUBJECT_KEYWORDS.some((keyword) => item.str.includes(keyword))
      );

      const hourOneParts = hourBuckets.get(1) || [];
      if (templateSubject && hourOneParts.length && !lessonRowHasSubject) {
        const h1text = buildClusterText(hourOneParts);
        const h2parts = hourBuckets.get(2) || [];
        const h2first = (buildClusterText(h2parts).split(/\r?\n/)[0] || '').trim();
        const h2onlyParse = parseCellText(
          stripLeadingTeacherLines(buildClusterText(h2parts)),
          column.className,
          block.day,
          2,
          allowedClasses
        );
        const tryMerged = parseCellText(
          stripLeadingTeacherLines(buildClusterText([...hourOneParts, ...h2parts])),
          column.className,
          block.day,
          1,
          allowedClasses
        );
        const isDoubleHour =
          isTeacherOnlyText(h1text) &&
          tryMerged.length === 1 &&
          h2onlyParse.length === 1 &&
          tryMerged[0].subject === h2onlyParse[0].subject;

        const shouldAttachTemplate =
          templateSubject &&
          (templateSubject.str === h2first || !isDoubleHour);

        if (shouldAttachTemplate && isTeacherOnlyText(h1text)) {
          hourBuckets.set(1, [templateSubject, ...hourOneParts]);
        }
      }

      const maxHour = Math.max(...block.hourRows.map((row) => row.hour));
      let hour = 1;

      while (hour <= maxHour) {
        const parts = hourBuckets.get(hour) || [];
        if (!parts.length) {
          hour += 1;
          continue;
        }

        let endHour = hour;
        let mergedParts = [...parts];

        while (endHour < maxHour && endHour - hour < 1) {
          const currentText = buildClusterText(mergedParts);
          const nextParts = hourBuckets.get(endHour + 1) || [];
          if (!nextParts.length) break;

          const nextText = buildClusterText(nextParts);
          const mergedText = stripLeadingTeacherLines(
            buildClusterText([...mergedParts, ...nextParts])
          );
          const currentParsed = parseCellText(
            stripLeadingTeacherLines(currentText),
            column.className,
            block.day,
            hour,
            allowedClasses
          );
          const mergedParsed = parseCellText(
            mergedText,
            column.className,
            block.day,
            hour,
            allowedClasses
          );

          if (
            isTeacherOnlyText(currentText) &&
            currentText.split(/\r?\n/).length === 1 &&
            hour > 1
          ) {
            const prevParsed = parseCellText(
              stripLeadingTeacherLines(
                buildClusterText(hourBuckets.get(hour - 1) || [])
              ),
              column.className,
              block.day,
              hour - 1,
              allowedClasses
            );
            const nextParsed = parseCellText(
              stripLeadingTeacherLines(nextText),
              column.className,
              block.day,
              hour + 1,
              allowedClasses
            );
            const orphanTeacher = currentText.trim();
            if (
              prevParsed.length === 1 &&
              nextParsed.length === 1 &&
              prevParsed[0].teacher === orphanTeacher &&
              prevParsed[0].subject !== nextParsed[0].subject
            ) {
              break;
            }
          }

          const nextSubjectLine = (nextText.split(/\r?\n/)[0] || '').trim();
          const nextStartsNewSubject = SUBJECT_KEYWORDS.some((keyword) =>
            nextSubjectLine.includes(keyword)
          );

          const sameSubject =
            currentParsed.length === 1 &&
            mergedParsed.length === 1 &&
            currentParsed[0].subject === mergedParsed[0].subject;

          const shouldMerge =
            mergedParsed.length > 0 &&
            (currentParsed.length === 0 ||
              isTeacherOnlyText(currentText) ||
              sameSubject) &&
            !(currentParsed.length > 0 &&
              mergedParsed.length > 0 &&
              !sameSubject &&
              currentParsed[0].subject !== mergedParsed[0].subject) &&
            !(currentParsed.length > 0 &&
              nextStartsNewSubject &&
              currentParsed[0].subject !== nextSubjectLine);

          if (!shouldMerge) break;

          endHour += 1;
          if (isTeacherOnlyText(currentText)) {
            mergedParts = [...nextParts];
          } else {
            mergedParts = [...mergedParts, ...nextParts];
          }
        }

        const cellDuration = endHour - hour + 1 > 1 ? endHour - hour + 1 : null;

        if (cellDuration) {
          pushCell({
            className: column.className,
            day: block.day,
            hour,
            text: stripLeadingTeacherLines(buildClusterText(mergedParts)),
            duration: cellDuration,
          });
          hour = endHour + 1;
          continue;
        }

        clusterColumnItems(parts, 14).forEach((cluster) => {
          const text = stripLeadingTeacherLines(buildClusterText(cluster));
          if (!text) return;
          pushCell({
            className: column.className,
            day: block.day,
            hour,
            text,
            duration: null,
          });
        });

        hour += 1;
      }
    });
  });

  return { cells, allowedClasses };
};

const buildCellsFromPage = (items) => {
  const layoutType = detectLayoutType(items);
  if (layoutType === 'compact') {
    return buildCellsCompactLayout(items);
  }
  return buildCellsGridLayout(items);
};

export const parsePdfFile = async (filePath, fileName = null) => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const lessons = [];
  let allowedClasses = new Set();
  const sourceFileName = fileName || path.basename(filePath);

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
        allowedClasses,
        {
          rawCellText: cell.text,
          duration: cell.duration || null,
          source: {
            fileName: sourceFileName,
            page: pageNumber,
            rowIndex: null,
            colIndex: null,
          },
        }
      );
      lessons.push(...parsed);
    });
  }

  return dedupeLessons(expandDurationLessons(fillDoubleHourSlots(lessons)));
};

const expandDurationLessons = (lessons) => {
  const extra = [];

  lessons.forEach((lesson) => {
    const duration = lesson.duration || 1;
    if (duration <= 1) return;

    for (let offset = 1; offset < duration; offset += 1) {
      extra.push({
        ...lesson,
        hour: lesson.hour + offset,
        duration: null,
      });
    }
  });

  return [...lessons, ...extra];
};

const fillDoubleHourSlots = (lessons) => {
  const byClassDay = new Map();

  lessons.forEach((lesson) => {
    const key = `${lesson.className}|${lesson.day}`;
    if (!byClassDay.has(key)) byClassDay.set(key, new Map());
    byClassDay.get(key).set(lesson.hour, lesson);
  });

  const extra = [];
  const removeKeys = new Set();

  byClassDay.forEach((hourMap) => {
    const hour2 = hourMap.get(2);
    const hour1 = hourMap.get(1);
    if (!hour2) return;

    const hour1IsWrongPlaceholder =
      hour1 &&
      hour2 &&
      hour1.subject !== hour2.subject &&
      hour1.teacher !== hour2.teacher;

    if (!hour1) {
      extra.push({ ...hour2, hour: 1 });
    } else if (hour1IsWrongPlaceholder) {
      removeKeys.add(`${hour1.className}|${hour1.day}|${hour1.hour}`);
      extra.push({ ...hour2, hour: 1 });
    }
  });

  const filtered = lessons.filter(
    (lesson) => !removeKeys.has(`${lesson.className}|${lesson.day}|${lesson.hour}`)
  );

  return [...filtered, ...extra];
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
      lesson.group || '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const parsePdfText = () => [];
