import { InterviewSession } from '../types';

export interface PerformanceHistoryRecord {
  interviewId: string;
  score: number;
  correct: number;
  incorrect: number;
  totalQuestions: number;
  date: string;
}

export interface ExportPerformanceCsvInput {
  candidateName?: string;
  sessions: InterviewSession[];
  history: PerformanceHistoryRecord[];
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/\r?\n|\r/g, ' ').trim();
  // Prevent CSV formula injection while keeping negative numbers intact
  if (/^[=+@\t]/.test(text) || (/^-/.test(text) && Number.isNaN(Number(text)))) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function averageQuestionMetric(
  session: InterviewSession | undefined,
  selector: (ev: InterviewSession['evaluations'][string]) => number | undefined
): string {
  if (!session?.evaluations) return '';
  const values = Object.values(session.evaluations)
    .map((ev) => (ev ? selector(ev) : undefined))
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
  if (!values.length) return '';
  return String(Math.round(values.reduce((sum, n) => sum + n, 0) / values.length));
}

function formatIsoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().split('T')[0];
}

export function exportPerformanceOverviewCsv({
  candidateName = 'Candidate',
  sessions,
  history,
}: ExportPerformanceCsvInput): void {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  // Merge history records with any completed sessions missing from history
  const seenIds = new Set(history.map((h) => h.interviewId));
  const extraCompleted: PerformanceHistoryRecord[] = sessions
    .filter((s) => !seenIds.has(s.id) && (s.status === 'completed' || Boolean(s.overallReport)))
    .map((s) => {
      const totalQuestions = s.questions?.length || 0;
      const evalList = Object.values(s.evaluations || {});
      const correct = evalList.filter((ev) => (ev?.score || 0) >= 60).length;
      return {
        interviewId: s.id,
        score: Number(s.overallReport?.overallScore) || 0,
        correct,
        incorrect: Math.max(0, totalQuestions - correct),
        totalQuestions,
        date: s.date,
      };
    });

  const combinedRows = [...history, ...extraCompleted].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const headers = [
    'Candidate',
    'Session ID',
    'Date',
    'Role',
    'Sector',
    'Round',
    'Difficulty',
    'Company / Exam',
    'Duration',
    'Overall Score (%)',
    'Rating',
    'Correct Answers',
    'Incorrect Answers',
    'Total Questions',
    'Technical Knowledge (%)',
    'Communication (%)',
    'Confidence (%)',
    'Relevance (%)',
    'Fluency (%)',
    'Problem Solving (%)',
    'Time Management (%)',
    'Summary',
  ];

  const rows = combinedRows.map((record) => {
    const session = sessionMap.get(record.interviewId);
    const report = session?.overallReport;
    const dm = report?.detailedMetrics;

    const technical =
      dm?.technicalKnowledge ??
      (averageQuestionMetric(session, (ev) => ev.metrics?.technicalAccuracy) || '');
    const communication =
      dm?.communication ??
      (averageQuestionMetric(session, (ev) => ev.metrics?.communication) || '');
    const confidence =
      dm?.confidence ??
      (averageQuestionMetric(session, (ev) => ev.metrics?.confidence) || '');
    const relevance =
      dm?.relevance ??
      (averageQuestionMetric(session, (ev) => ev.metrics?.relevance) || '');
    const fluency =
      dm?.fluency ??
      (averageQuestionMetric(session, (ev) => ev.metrics?.fluency) || '');
    const problemSolving = dm?.problemSolving ?? '';
    const timeManagement = dm?.timeManagement ?? '';

    return [
      candidateName,
      record.interviewId,
      formatIsoDate(record.date),
      session?.role || 'Mock Interview',
      session?.sector || '',
      session?.roundLabel || session?.round || 'Standard',
      session?.difficulty || '',
      session?.companyName || session?.examName || '',
      session?.duration || '',
      record.score,
      report?.result || '',
      record.correct,
      record.incorrect,
      record.totalQuestions,
      technical,
      communication,
      confidence,
      relevance,
      fluency,
      problemSolving,
      timeManagement,
      report?.summary || '',
    ];
  });

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  // UTF-8 BOM ensures Excel/Google Sheets preserve special characters cleanly
  const blob = new Blob([`\uFEFF${csvLines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `intervyou-performance-report-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
