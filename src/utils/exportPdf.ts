import { jsPDF } from 'jspdf';
import { InterviewSession, UserProfile } from '../types';

export interface PerformanceOverviewPdfData {
  totalInterviews: number;
  averageScore: number;
  bestScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  history: Array<{
    interviewId: string;
    score: number;
    correct: number;
    incorrect: number;
    totalQuestions: number;
    date: string;
  }>;
}

/**
 * Normalize text so standard jsPDF Type1 Helvetica fonts never render broken glyph boxes
 * for smart quotes, bullets, em-dashes, or emoji characters.
 */
function cleanPdfText(input: unknown): string {
  return String(input ?? '')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25AA]/g, '*')
    .replace(/[\u2713\u2714]/g, '[OK]')
    .replace(/[\u2717\u2718]/g, '[X]')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getScoreRgb(score: number): [number, number, number] {
  if (score >= 75) return [22, 163, 74]; // emerald-600
  if (score >= 55) return [37, 99, 235]; // blue-600
  return [220, 38, 38]; // red-600
}

function formatMetricLabel(key: string): string {
  return cleanPdfText(
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
  );
}

function addTopAccentBar(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 6, 'F');
}

function addPageFooters(doc: jsPDF, title: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(cleanPdfText(`Intervyou AI - ${title}`), margin, pageHeight - 20);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }
}

/**
 * Format and download a single Interview Session Performance Report as a PDF using jsPDF.
 */
export function exportSessionReportPdf(
  session: InterviewSession,
  candidateName = 'Candidate',
  candidateEmail = ''
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const bottomLimit = pageHeight - 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      addTopAccentBar(doc, pageWidth);
      y = margin + 4;
    }
  };

  const writeWrappedLines = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight = 13
  ) => {
    const lines: string[] = doc.splitTextToSize(cleanPdfText(text), maxWidth);
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  addTopAccentBar(doc, pageWidth);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('INTERVYOU AI', margin, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Interview Performance Evaluation Report', margin, y + 31);

  const sessionDateObj = new Date(session.date || Date.now());
  const formattedDate = Number.isNaN(sessionDateObj.getTime())
    ? 'Recent Session'
    : sessionDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  const generatedStamp = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  doc.text(`Session Date: ${formattedDate}`, pageWidth - margin, y + 16, { align: 'right' });
  doc.text(`Exported: ${generatedStamp}`, pageWidth - margin, y + 30, { align: 'right' });

  y += 46;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Candidate & Session Summary Card
  const report = session.overallReport;
  const score = Math.round(Number(report?.overallScore ?? 0));
  const resultLabel = cleanPdfText(
    report?.result || (score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Average' : 'Needs Improvement')
  );
  const [sr, sg, sb] = getScoreRgb(score);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 92, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const roleTitle = cleanPdfText(session.role || 'Mock Interview Candidate');
  doc.text(doc.splitTextToSize(roleTitle, contentWidth - 135)[0] || roleTitle, margin + 16, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const candidateLine = `Candidate: ${cleanPdfText(candidateName || 'Candidate')}${candidateEmail ? ` (${cleanPdfText(candidateEmail)})` : ''}`;
  doc.text(doc.splitTextToSize(candidateLine, contentWidth - 135)[0] || candidateLine, margin + 16, y + 42);

  const metaLine = `Sector: ${cleanPdfText(session.sector || 'Private')}   |   Difficulty: ${cleanPdfText(session.difficulty || 'Intermediate')}   |   Round: ${cleanPdfText(session.roundLabel || session.round || session.interviewType || 'AI Mock')}`;
  doc.text(doc.splitTextToSize(metaLine, contentWidth - 135)[0] || metaLine, margin + 16, y + 58);

  const totalQs = session.questions?.length || 0;
  const answeredQs = Object.values(session.answers || {}).filter((a) => a && a !== 'SKIPPED').length;
  const completionPct = totalQs > 0 ? Math.round((answeredQs / totalQs) * 100) : 0;
  doc.text(
    `Questions Answered: ${answeredQs}/${totalQs} (${completionPct}%)   |   Duration: ${cleanPdfText(session.duration || 'N/A')}`,
    margin + 16,
    y + 74
  );

  // Score Box Right
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(pageWidth - margin - 108, y + 12, 92, 68, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(sr, sg, sb);
  doc.text(`${score}%`, pageWidth - margin - 62, y + 42, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('OVERALL SCORE', pageWidth - margin - 62, y + 56, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(sr, sg, sb);
  doc.text(resultLabel.toUpperCase(), pageWidth - margin - 62, y + 70, { align: 'center' });

  y += 114;

  // Executive Summary
  if (report?.summary) {
    ensureSpace(64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Executive Evaluation Summary', margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    writeWrappedLines(report.summary, margin, contentWidth, 14);
    y += 12;
  }

  // AI Performance Breakdown (detailedMetrics)
  const metricEntries = Object.entries(report?.detailedMetrics || {}).filter(
    ([, val]) => typeof val === 'number'
  );
  if (metricEntries.length > 0) {
    ensureSpace(70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Competency & Performance Metrics', margin, y);
    y += 18;

    const colGap = 24;
    const colWidth = (contentWidth - colGap) / 2;

    for (let i = 0; i < metricEntries.length; i += 2) {
      ensureSpace(30);
      for (let col = 0; col < 2; col += 1) {
        const entry = metricEntries[i + col];
        if (!entry) continue;
        const [k, rawVal] = entry;
        const val = Math.max(0, Math.min(100, Math.round(Number(rawVal) || 0)));
        const xBase = margin + col * (colWidth + colGap);
        const [mr, mg, mb] = getScoreRgb(val);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(formatMetricLabel(k), xBase, y);

        doc.setTextColor(mr, mg, mb);
        doc.text(`${val}%`, xBase + colWidth, y, { align: 'right' });

        // Progress bar track + fill
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(xBase, y + 5, colWidth, 6, 3, 3, 'F');
        if (val > 0) {
          doc.setFillColor(mr, mg, mb);
          doc.roundedRect(xBase, y + 5, Math.max(6, (colWidth * val) / 100), 6, 3, 3, 'F');
        }
      }
      y += 24;
    }
    y += 8;
  }

  // Skill Gap Analysis
  const skillGapEntries = Object.entries(report?.skillGapAnalysis || {}).filter(
    ([, val]) => typeof val === 'number'
  );
  if (skillGapEntries.length > 0) {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Skill Gap Assessment', margin, y);
    y += 16;

    const colGap = 24;
    const colWidth = (contentWidth - colGap) / 2;
    for (let i = 0; i < skillGapEntries.length; i += 2) {
      ensureSpace(22);
      for (let col = 0; col < 2; col += 1) {
        const entry = skillGapEntries[i + col];
        if (!entry) continue;
        const [skill, scoreOutOf10] = entry;
        const xBase = margin + col * (colWidth + colGap);
        const pct = Math.max(0, Math.min(100, Math.round((Number(scoreOutOf10) || 0) * 10)));
        const [sr2, sg2, sb2] = getScoreRgb(pct);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.text(cleanPdfText(skill), xBase, y);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(sr2, sg2, sb2);
        doc.text(`${Number(scoreOutOf10).toFixed(1)} / 10`, xBase + colWidth, y, { align: 'right' });
      }
      y += 16;
    }
    y += 10;
  }

  // Strengths, Growth Roadmap & Career Advice
  if (report?.keyTakeaways?.length) {
    ensureSpace(55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Primary Strengths & Key Takeaways', margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    for (const item of report.keyTakeaways) {
      ensureSpace(20);
      doc.setFillColor(22, 163, 74);
      doc.circle(margin + 5, y - 3, 2, 'F');
      writeWrappedLines(item, margin + 14, contentWidth - 16, 13);
      y += 2;
    }
    y += 8;
  }

  if (report?.nextSteps?.length) {
    ensureSpace(55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Growth Roadmap & Next Steps', margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    for (const step of report.nextSteps) {
      ensureSpace(20);
      doc.setFillColor(124, 58, 237);
      doc.circle(margin + 5, y - 3, 2, 'F');
      writeWrappedLines(step, margin + 14, contentWidth - 16, 13);
      y += 2;
    }
    y += 8;
  }

  if (report?.careerAdvice) {
    ensureSpace(55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235);
    doc.text('Career Recommendation', margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    writeWrappedLines(report.careerAdvice, margin, contentWidth, 13);
    y += 14;
  }

  // Question-by-Question Detailed Review
  if (session.questions?.length) {
    ensureSpace(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(`Question-by-Question Detailed Review (${session.questions.length})`, margin, y);
    y += 18;

    session.questions.forEach((q, idx) => {
      ensureSpace(85);

      const answerObj = Array.isArray(session.answers)
        ? session.answers.find((a: any) => a.questionId === q.id)
        : (session.answers as Record<string, any> | undefined)?.[q.id];
      const answerText =
        typeof answerObj === 'string'
          ? answerObj === 'SKIPPED'
            ? 'Candidate skipped this question.'
            : answerObj
          : answerObj?.answerText || 'No response recorded.';

      const evalData = answerObj?.evaluationJson || session.evaluations?.[q.id];
      const qScore = typeof evalData?.score === 'number' ? Math.round(evalData.score) : null;

      // Question Banner
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, contentWidth, 24, 4, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const qHeader = `Q${idx + 1}${q.category ? ` - ${cleanPdfText(q.category)}` : ''}`;
      doc.text(qHeader, margin + 10, y + 16);

      if (qScore !== null) {
        const [qr, qg, qb] = getScoreRgb(qScore);
        doc.setTextColor(qr, qg, qb);
        doc.text(`Score: ${qScore}/100`, pageWidth - margin - 10, y + 16, { align: 'right' });
      }

      y += 34;

      // Question Prompt
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const promptText = cleanPdfText(q.question || (q as any).prompt || 'Interview Question');
      writeWrappedLines(promptText, margin + 4, contentWidth - 8, 13);
      y += 6;

      // Candidate Answer
      ensureSpace(32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('CANDIDATE RESPONSE', margin + 4, y);
      y += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      writeWrappedLines(answerText, margin + 4, contentWidth - 8, 13);
      y += 6;

      if (evalData) {
        if (evalData.feedback) {
          ensureSpace(30);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(37, 99, 235);
          doc.text('AI FEEDBACK', margin + 4, y);
          y += 12;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(51, 65, 85);
          writeWrappedLines(evalData.feedback, margin + 4, contentWidth - 8, 12.5);
          y += 4;
        }

        if (evalData.strengths?.length) {
          ensureSpace(24);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(22, 163, 74);
          doc.text('STRENGTHS: ', margin + 4, y);
          y += 12;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          writeWrappedLines(evalData.strengths.map(cleanPdfText).join(' | '), margin + 4, contentWidth - 8, 12);
          y += 4;
        }

        if (evalData.weaknesses?.length) {
          ensureSpace(24);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(217, 119, 6);
          doc.text('AREAS TO IMPROVE: ', margin + 4, y);
          y += 12;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          writeWrappedLines(evalData.weaknesses.map(cleanPdfText).join(' | '), margin + 4, contentWidth - 8, 12);
          y += 4;
        }

        const modelAnswer = evalData.idealAnswer || evalData.improvedAnswer;
        if (modelAnswer) {
          ensureSpace(34);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 64, 175);
          doc.text('IDEAL MODEL RESPONSE', margin + 4, y);
          y += 12;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          writeWrappedLines(modelAnswer, margin + 4, contentWidth - 8, 12);
          y += 6;
        }
      }

      ensureSpace(12);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
    });
  }

  addPageFooters(doc, `${cleanPdfText(session.role || 'Interview')} Performance Report`);

  const cleanRole = (session.role || 'Interview').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDate = formattedDate.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Intervyou_Report_${cleanRole}_${cleanDate}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Format and download an executive Performance Overview PDF across all candidate interviews using jsPDF.
 */
export function exportPerformanceOverviewPdf(params: {
  user?: Partial<UserProfile> | null;
  sessions: InterviewSession[];
  performance?: PerformanceOverviewPdfData | null;
}): string {
  const { user, sessions, performance } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const bottomLimit = pageHeight - 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      addTopAccentBar(doc, pageWidth);
      y = margin + 4;
    }
  };

  addTopAccentBar(doc, pageWidth);

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('INTERVYOU AI', margin, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Candidate Overall Performance Summary', margin, y + 31);
  doc.text(`Generated: ${generatedDate}`, pageWidth - margin, y + 16, { align: 'right' });

  y += 46;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Candidate Banner
  const candidateName = cleanPdfText(user?.fullName || 'Candidate');
  const candidateEmail = cleanPdfText(user?.email || '');
  const completedSessions = sessions.filter((s) => s.status === 'completed' || Boolean(s.overallReport));

  const totalCompleted = performance?.totalInterviews ?? completedSessions.length;
  const avgScore =
    performance?.averageScore ??
    (completedSessions.length
      ? Math.round(
          completedSessions.reduce((sum, s) => sum + (s.overallReport?.overallScore || 0), 0) /
            completedSessions.length
        )
      : 0);
  const bestScore =
    performance?.bestScore ??
    (completedSessions.length
      ? Math.max(...completedSessions.map((s) => s.overallReport?.overallScore || 0))
      : 0);
  const correctAnswers = performance?.correctAnswers ?? 0;
  const incorrectAnswers = performance?.incorrectAnswers ?? 0;
  const totalEvaluated = correctAnswers + incorrectAnswers;
  const accuracyPct = totalEvaluated > 0 ? Math.round((correctAnswers / totalEvaluated) * 100) : 0;
  const readiness = avgScore >= 75 ? 'Interview Ready' : avgScore >= 50 ? 'Developing' : 'Foundation Stage';

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 74, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(candidateName, margin + 16, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const eduSummary = user?.education?.degree
    ? `${cleanPdfText(user.education.degree)}${user.education.specialization ? ` (${cleanPdfText(user.education.specialization)})` : ''}${user.education.college ? ` - ${cleanPdfText(user.education.college)}` : ''}`
    : cleanPdfText(user?.qualification || 'Mock Interview Candidate');
  doc.text(candidateEmail ? `${candidateEmail}  |  ${eduSummary}` : eduSummary, margin + 16, y + 42);

  if (user?.skills?.length) {
    const skillsLine = `Core Skills: ${user.skills.slice(0, 8).map(cleanPdfText).join(', ')}`;
    doc.text(doc.splitTextToSize(skillsLine, contentWidth - 150)[0] || skillsLine, margin + 16, y + 58);
  }

  // Readiness badge right
  const [ar, ag, ab] = getScoreRgb(avgScore);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(ar, ag, ab);
  doc.text(`${avgScore}%`, pageWidth - margin - 18, y + 34, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('AVERAGE SCORE', pageWidth - margin - 18, y + 48, { align: 'right' });
  doc.setTextColor(ar, ag, ab);
  doc.text(readiness.toUpperCase(), pageWidth - margin - 18, y + 61, { align: 'right' });

  y += 94;

  // KPI Grid (3 x 2 cards)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Performance Indicators', margin, y);
  y += 14;

  const kpis = [
    { label: 'Sessions Completed', value: String(totalCompleted) },
    { label: 'Average Score', value: `${avgScore}%` },
    { label: 'Personal Best', value: `${bestScore}%` },
    { label: 'Correct Answers', value: String(correctAnswers) },
    { label: 'Incorrect / Needs Work', value: String(incorrectAnswers) },
    { label: 'Answer Accuracy', value: totalEvaluated > 0 ? `${accuracyPct}%` : 'N/A' },
  ];

  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cardHeight = 52;

  for (let row = 0; row < 2; row += 1) {
    ensureSpace(cardHeight + 12);
    for (let col = 0; col < 3; col += 1) {
      const kpi = kpis[row * 3 + col];
      const cx = margin + col * (cardWidth + cardGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, y, cardWidth, cardHeight, 5, 5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, cx + 12, y + 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, cx + 12, y + 40);
    }
    y += cardHeight + 12;
  }

  y += 10;

  // Aggregated Competency Matrix across completed interviews
  const metricAccumulator: Record<string, { sum: number; count: number }> = {};
  for (const s of completedSessions) {
    const dm = s.overallReport?.detailedMetrics;
    if (dm) {
      for (const [k, v] of Object.entries(dm)) {
        if (typeof v === 'number') {
          if (!metricAccumulator[k]) metricAccumulator[k] = { sum: 0, count: 0 };
          metricAccumulator[k].sum += v;
          metricAccumulator[k].count += 1;
        }
      }
    }
  }
  const avgMetrics = Object.entries(metricAccumulator)
    .map(([k, acc]) => [k, Math.round(acc.sum / acc.count)] as const)
    .slice(0, 8);

  if (avgMetrics.length > 0) {
    ensureSpace(65);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Average Competency Breakdown', margin, y);
    y += 16;

    const colGap = 24;
    const colWidth = (contentWidth - colGap) / 2;
    for (let i = 0; i < avgMetrics.length; i += 2) {
      ensureSpace(28);
      for (let col = 0; col < 2; col += 1) {
        const entry = avgMetrics[i + col];
        if (!entry) continue;
        const [k, val] = entry;
        const xBase = margin + col * (colWidth + colGap);
        const [mr, mg, mb] = getScoreRgb(val);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(formatMetricLabel(k), xBase, y);
        doc.setTextColor(mr, mg, mb);
        doc.text(`${val}%`, xBase + colWidth, y, { align: 'right' });

        doc.setFillColor(226, 232, 240);
        doc.roundedRect(xBase, y + 5, colWidth, 6, 3, 3, 'F');
        if (val > 0) {
          doc.setFillColor(mr, mg, mb);
          doc.roundedRect(xBase, y + 5, Math.max(6, (colWidth * val) / 100), 6, 3, 3, 'F');
        }
      }
      y += 24;
    }
    y += 8;
  }

  // Session History Table
  ensureSpace(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Recent Interview Performance Log', margin, y);
  y += 14;

  const sessionLookup = new Map(sessions.map((s) => [s.id, s]));
  const rows =
    performance?.history?.length
      ? [...performance.history].reverse().slice(0, 15).map((h) => {
          const matched = sessionLookup.get(h.interviewId);
          return {
            date: new Date(h.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            role: cleanPdfText(matched?.role || 'Mock Interview'),
            sector: cleanPdfText(matched?.sector || 'Private'),
            questions: `${h.correct}/${h.totalQuestions}`,
            score: Math.round(h.score),
          };
        })
      : sessions.slice(0, 15).map((s) => ({
          date: new Date(s.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          role: cleanPdfText(s.role || 'Mock Interview'),
          sector: cleanPdfText(s.sector || 'Private'),
          questions: `${s.questions?.length || 0} Qs`,
          score: Math.round(s.overallReport?.overallScore ?? 0),
        }));

  if (rows.length > 0) {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('DATE', margin + 8, y + 15);
    doc.text('ROLE / INTERVIEW', margin + 92, y + 15);
    doc.text('SECTOR', margin + 295, y + 15);
    doc.text('RESULT', margin + 375, y + 15);
    doc.text('SCORE', pageWidth - margin - 10, y + 15, { align: 'right' });
    y += 28;

    for (const row of rows) {
      ensureSpace(26);
      const [rr, rg, rb] = getScoreRgb(row.score);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(row.date, margin + 8, y + 13);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const roleTrimmed = doc.splitTextToSize(row.role, 190)[0] || row.role;
      doc.text(roleTrimmed, margin + 92, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(row.sector, margin + 295, y + 13);
      doc.text(row.questions, margin + 375, y + 13);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(rr, rg, rb);
      doc.text(`${row.score}%`, pageWidth - margin - 10, y + 13, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 20, pageWidth - margin, y + 20);
      y += 24;
    }
    y += 12;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No completed interview sessions recorded yet. Start a mock interview to generate scores and insights.', margin, y + 12);
    y += 30;
  }

  // Recent Highlights & Focus Areas
  const recentTakeaways = Array.from(
    new Set(completedSessions.flatMap((s) => s.overallReport?.keyTakeaways || []))
  ).slice(0, 4);
  const recentNextSteps = Array.from(
    new Set(completedSessions.flatMap((s) => s.overallReport?.nextSteps || []))
  ).slice(0, 4);

  if (recentTakeaways.length > 0 || recentNextSteps.length > 0) {
    ensureSpace(70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Aggregated Insights & Improvement Focus', margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);

    for (const item of recentTakeaways) {
      ensureSpace(18);
      doc.setFillColor(22, 163, 74);
      doc.circle(margin + 5, y - 3, 2, 'F');
      const lines: string[] = doc.splitTextToSize(`Strength: ${cleanPdfText(item)}`, contentWidth - 16);
      for (const l of lines) {
        ensureSpace(14);
        doc.text(l, margin + 14, y);
        y += 13;
      }
    }

    for (const step of recentNextSteps) {
      ensureSpace(18);
      doc.setFillColor(37, 99, 235);
      doc.circle(margin + 5, y - 3, 2, 'F');
      const lines: string[] = doc.splitTextToSize(`Focus: ${cleanPdfText(step)}`, contentWidth - 16);
      for (const l of lines) {
        ensureSpace(14);
        doc.text(l, margin + 14, y);
        y += 13;
      }
    }
  }

  addPageFooters(doc, 'Candidate Performance Overview');

  const safeName = (user?.fullName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
  const safeDate = generatedDate.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Intervyou_Performance_Overview_${safeName}_${safeDate}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Format and download an overall Interview History summary PDF
 */
export function exportHistorySummaryPdf(sessions: InterviewSession[], candidateName = 'Candidate') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  addTopAccentBar(doc, pageWidth);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text('INTERVYOU AI', margin, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Complete Candidate Interview History Log', margin, y + 34);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(`Generated: ${formattedDate}`, pageWidth - margin, y + 20, { align: 'right' });

  y += 55;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Overview Stats
  const completed = sessions.filter((s) => s.status === 'completed' || s.overallReport);
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, s) => sum + (s.overallReport?.overallScore || 0), 0) / completed.length)
    : 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`Candidate: ${cleanPdfText(candidateName)}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Interviews: ${sessions.length}  |  Completed: ${completed.length}  |  Average Score: ${avgScore}%`, margin, y + 15);

  y += 40;

  // Table Headers
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('DATE', margin + 8, y + 16);
  doc.text('ROLE / TOPIC', margin + 80, y + 16);
  doc.text('SECTOR', margin + 250, y + 16);
  doc.text('LEVEL', margin + 340, y + 16);
  doc.text('SCORE', pageWidth - margin - 50, y + 16);

  y += 28;

  // Table Rows
  sessions.forEach((s) => {
    if (y > pageHeight - 60) {
      doc.addPage();
      addTopAccentBar(doc, pageWidth);
      y = margin + 20;
    }

    const sessionDate = new Date(s.date || Date.now()).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const sScore = s.overallReport?.overallScore ?? 0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(sessionDate, margin + 8, y + 14);

    doc.setFont('helvetica', 'bold');
    const cleanRole = cleanPdfText(s.role || 'Mock Session');
    doc.text(doc.splitTextToSize(cleanRole, 160)[0] || cleanRole, margin + 80, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.text(cleanPdfText(s.sector || 'Private'), margin + 250, y + 14);
    doc.text(cleanPdfText(s.difficulty || 'Intermediate'), margin + 340, y + 14);

    doc.setFont('helvetica', 'bold');
    const [r, g, b] = getScoreRgb(sScore);
    doc.setTextColor(r, g, b);
    doc.text(`${sScore}%`, pageWidth - margin - 50, y + 14);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 20, pageWidth - margin, y + 20);
    y += 24;
  });

  addPageFooters(doc, 'Interview History Summary');
  doc.save(`Intervyou_History_Summary_${formattedDate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}
