import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Link } from 'react-router-dom';
import { Flame, Grid3X3, Play, TrendingDown, TrendingUp } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import type { InterviewSession, Sector } from '../types';

interface SkillTopicHeatmapProps {
  sessions: InterviewSession[];
}

type SortMode = 'weakest' | 'strongest' | 'frequency';
type SectorFilter = 'All' | Sector;

interface HeatmapCell {
  topic: string;
  sessionId: string;
  sessionIndex: number;
  sessionLabel: string;
  role: string;
  dateStr: string;
  score: number | null;
  questionCount: number;
}

interface TopicSummary {
  topic: string;
  averageScore: number;
  sessionsCount: number;
  totalQuestions: number;
  tier: 'Strong' | 'Proficient' | 'Developing' | 'Needs Focus';
}

interface SessionColumn {
  id: string;
  shortLabel: string;
  dateLabel: string;
  role: string;
  sector: Sector;
  overallScore: number;
}

function normalizeTopicName(raw?: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!cleaned) return 'General';
  return cleaned
    .split(' ')
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
    .slice(0, 28);
}

function getTier(score: number): TopicSummary['tier'] {
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Proficient';
  if (score >= 55) return 'Developing';
  return 'Needs Focus';
}

function extractSessionTopicScores(session: InterviewSession): Map<string, { sum: number; count: number }> {
  const topicMap = new Map<string, { sum: number; count: number }>();

  const addSample = (topicRaw: string, rawScore: number, countWeight = 1) => {
    if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(rawScore)));
    const topic = normalizeTopicName(topicRaw);
    const prev = topicMap.get(topic) || { sum: 0, count: 0 };
    prev.sum += clamped * countWeight;
    prev.count += countWeight;
    topicMap.set(topic, prev);
  };

  // 1. Primary source: evaluated questions grouped by question.category
  const evals = session.evaluations || {};
  for (const q of session.questions || []) {
    const ev = evals[q.id];
    if (ev && typeof ev.score === 'number') {
      addSample(q.category || session.roundLabel || 'General', ev.score, 1);
    }
  }

  // 2. Secondary source: structured skillGapAnalysis from completed report
  const gaps = session.overallReport?.skillGapAnalysis;
  if (gaps && typeof gaps === 'object') {
    for (const [skillKey, rawVal] of Object.entries(gaps)) {
      if (typeof rawVal === 'number' && !Number.isNaN(rawVal)) {
        const normalized = normalizeTopicName(skillKey);
        if (!topicMap.has(normalized)) {
          const scaled = rawVal <= 10 ? rawVal * 10 : rawVal;
          addSample(normalized, scaled, 1);
        }
      }
    }
  }

  // 3. Fallback if evaluations exist without mapped questions
  if (topicMap.size === 0) {
    const evalList = Object.values(evals);
    if (evalList.length > 0) {
      const avg = evalList.reduce((acc, e) => acc + (Number(e.score) || 0), 0) / evalList.length;
      addSample(session.roundLabel || session.interviewType || 'Core Interview', avg, evalList.length);
    } else if (typeof session.overallReport?.overallScore === 'number') {
      addSample(session.roundLabel || session.interviewType || 'Core Interview', session.overallReport.overallScore, 1);
    }
  }

  return topicMap;
}

export default function SkillTopicHeatmap({ sessions }: SkillTopicHeatmapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>('weakest');
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('All');
  const [hoveredCell, setHoveredCell] = useState<{
    visible: boolean;
    x: number;
    y: number;
    cell: HeatmapCell | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    cell: null,
  });

  const {
    columns,
    topics,
    cells,
    strongestTopic,
    weakestTopic,
    totalEvaluatedSessions,
    availableSectors,
  } = useMemo(() => {
    const evaluated = sessions.filter(
      (s) =>
        s.status === 'completed' ||
        Boolean(s.overallReport) ||
        (s.evaluations && Object.keys(s.evaluations).length > 0)
    );

    const sectorsPresent = Array.from(new Set(evaluated.map((s) => s.sector)));
    const filtered =
      sectorFilter === 'All'
        ? evaluated
        : evaluated.filter((s) => s.sector === sectorFilter);

    // Chronological last 10 sessions for matrix columns
    const sortedSessions = [...filtered]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);

    if (sortedSessions.length === 0) {
      return {
        columns: [] as SessionColumn[],
        topics: [] as TopicSummary[],
        cells: [] as HeatmapCell[],
        strongestTopic: null as TopicSummary | null,
        weakestTopic: null as TopicSummary | null,
        totalEvaluatedSessions: evaluated.length,
        availableSectors: sectorsPresent,
      };
    }

    const sessionColumns: SessionColumn[] = sortedSessions.map((s, idx) => ({
      id: s.id,
      shortLabel: `#${idx + 1}`,
      dateLabel: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      role: s.role || 'Mock Interview',
      sector: s.sector,
      overallScore: Number(s.overallReport?.overallScore) || 0,
    }));

    const perSessionTopics = sortedSessions.map((s) => extractSessionTopicScores(s));
    const aggregateByTopic = new Map<
      string,
      { scoreSum: number; sessionsCount: number; totalQuestions: number }
    >();

    perSessionTopics.forEach((topicMap) => {
      topicMap.forEach((stats, topicName) => {
        const sessionTopicAvg = Math.round(stats.sum / Math.max(1, stats.count));
        const curr = aggregateByTopic.get(topicName) || {
          scoreSum: 0,
          sessionsCount: 0,
          totalQuestions: 0,
        };
        curr.scoreSum += sessionTopicAvg;
        curr.sessionsCount += 1;
        curr.totalQuestions += stats.count;
        aggregateByTopic.set(topicName, curr);
      });
    });

    const topicSummaries: TopicSummary[] = Array.from(aggregateByTopic.entries()).map(
      ([topic, agg]) => {
        const avg = Math.round(agg.scoreSum / Math.max(1, agg.sessionsCount));
        return {
          topic,
          averageScore: avg,
          sessionsCount: agg.sessionsCount,
          totalQuestions: agg.totalQuestions,
          tier: getTier(avg),
        };
      }
    );

    const byBest = [...topicSummaries].sort((a, b) => b.averageScore - a.averageScore);
    const strongest =
      byBest.length > 1 || (byBest[0] && byBest[0].averageScore >= 70) ? byBest[0] : null;
    const weakest =
      byBest.length > 1
        ? byBest[byBest.length - 1]
        : byBest[0] && byBest[0].averageScore < 70
        ? byBest[0]
        : null;

    const orderedTopics = [...topicSummaries].sort((a, b) => {
      if (sortMode === 'strongest') return b.averageScore - a.averageScore;
      if (sortMode === 'frequency') return b.totalQuestions - a.totalQuestions || b.averageScore - a.averageScore;
      return a.averageScore - b.averageScore;
    });

    const matrixCells: HeatmapCell[] = [];
    orderedTopics.forEach((tSummary) => {
      sortedSessions.forEach((sess, colIdx) => {
        const sample = perSessionTopics[colIdx].get(tSummary.topic);
        const score = sample ? Math.round(sample.sum / Math.max(1, sample.count)) : null;
        matrixCells.push({
          topic: tSummary.topic,
          sessionId: sess.id,
          sessionIndex: colIdx,
          sessionLabel: sessionColumns[colIdx].shortLabel,
          role: sessionColumns[colIdx].role,
          dateStr: sessionColumns[colIdx].dateLabel,
          score,
          questionCount: sample?.count || 0,
        });
      });
    });

    return {
      columns: sessionColumns,
      topics: orderedTopics,
      cells: matrixCells,
      strongestTopic: strongest,
      weakestTopic: weakest,
      totalEvaluatedSessions: evaluated.length,
      availableSectors: sectorsPresent,
    };
  }, [sessions, sortMode, sectorFilter]);

  // Render D3 Matrix Heatmap
  useEffect(() => {
    if (!svgRef.current || topics.length === 0 || columns.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 44, right: 82, bottom: 20, left: 170 };
    const cellW = Math.max(52, Math.min(76, Math.floor(620 / Math.max(1, columns.length))));
    const cellH = 42;
    const gridW = columns.length * cellW;
    const gridH = topics.length * cellH;
    const width = margin.left + gridW + margin.right;
    const height = margin.top + gridH + margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3
      .scaleBand<string>()
      .domain(columns.map((c) => c.id))
      .range([0, gridW])
      .padding(0.12);

    const yScale = d3
      .scaleBand<string>()
      .domain(topics.map((t) => t.topic))
      .range([0, gridH])
      .padding(0.14);

    // D3 Threshold Scale for Score Readiness Tiers
    const fillScale = d3
      .scaleThreshold<number, string>()
      .domain([55, 70, 85])
      .range(
        isDark
          ? ['#7f1d1d', '#78350f', '#1e3a8a', '#065f46']
          : ['#fecaca', '#fde68a', '#bfdbfe', '#a7f3d0']
      );

    const textColorScale = d3
      .scaleThreshold<number, string>()
      .domain([55, 70, 85])
      .range(
        isDark
          ? ['#fecaca', '#fde68a', '#bfdbfe', '#a7f3d0']
          : ['#991b1b', '#92400e', '#1e40af', '#065f46']
      );

    const emptyFill = isDark ? '#0f172a' : '#f8fafc';
    const emptyStroke = isDark ? '#1e293b' : '#e2e8f0';
    const labelColor = isDark ? '#cbd5e1' : '#334155';
    const subLabelColor = isDark ? '#64748b' : '#64748b';

    // Top X-axis Session Headers
    const colHeaders = g
      .selectAll<SVGGElement, SessionColumn>('g.col-header')
      .data(columns)
      .enter()
      .append('g')
      .attr('class', 'col-header')
      .attr('transform', (d) => `translate(${(xScale(d.id) || 0) + xScale.bandwidth() / 2}, -10)`);

    colHeaders
      .append('text')
      .attr('y', -14)
      .attr('text-anchor', 'middle')
      .attr('fill', labelColor)
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('font-variant-numeric', 'tabular-nums')
      .text((d) => d.shortLabel);

    colHeaders
      .append('text')
      .attr('y', -1)
      .attr('text-anchor', 'middle')
      .attr('fill', subLabelColor)
      .style('font-size', '10px')
      .text((d) => d.dateLabel);

    // "Avg" Summary Header
    const avgColX = gridW + 18;
    const avgColW = 54;
    g.append('line')
      .attr('x1', gridW + 8)
      .attr('x2', gridW + 8)
      .attr('y1', -28)
      .attr('y2', gridH)
      .attr('stroke', isDark ? '#1e293b' : '#e2e8f0')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', avgColX + avgColW / 2)
      .attr('y', -11)
      .attr('text-anchor', 'middle')
      .attr('fill', labelColor)
      .style('font-size', '11px')
      .style('font-weight', '700')
      .text('Avg');

    // Left Y-axis Topic Labels
    const rowLabels = g
      .selectAll<SVGGElement, TopicSummary>('g.row-label')
      .data(topics)
      .enter()
      .append('g')
      .attr('class', 'row-label')
      .attr('transform', (d) => `translate(-12, ${(yScale(d.topic) || 0) + yScale.bandwidth() / 2})`);

    rowLabels
      .append('text')
      .attr('y', -2)
      .attr('text-anchor', 'end')
      .attr('fill', labelColor)
      .style('font-size', '12px')
      .style('font-weight', '600')
      .text((d) => d.topic);

    rowLabels
      .append('text')
      .attr('y', 11)
      .attr('text-anchor', 'end')
      .attr('fill', subLabelColor)
      .style('font-size', '10px')
      .style('font-variant-numeric', 'tabular-nums')
      .text((d) => `${d.totalQuestions} ${d.totalQuestions === 1 ? 'q' : 'qs'} · ${d.tier}`);

    // Topic Average Cells (Right Summary Column)
    const avgGroup = g
      .selectAll<SVGGElement, TopicSummary>('g.avg-cell')
      .data(topics)
      .enter()
      .append('g')
      .attr('class', 'avg-cell')
      .attr('transform', (d) => `translate(${avgColX}, ${yScale(d.topic) || 0})`);

    avgGroup
      .append('rect')
      .attr('width', avgColW)
      .attr('height', yScale.bandwidth())
      .attr('rx', 7)
      .attr('ry', 7)
      .attr('fill', (d) => fillScale(d.averageScore));

    avgGroup
      .append('text')
      .attr('x', avgColW / 2)
      .attr('y', yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => textColorScale(d.averageScore))
      .style('font-size', '12px')
      .style('font-weight', '800')
      .style('font-variant-numeric', 'tabular-nums')
      .text((d) => `${d.averageScore}%`);

    // Matrix Score Cells
    const cellGroups = g
      .selectAll<SVGGElement, HeatmapCell>('g.matrix-cell')
      .data(cells)
      .enter()
      .append('g')
      .attr('class', 'matrix-cell cursor-pointer')
      .attr(
        'transform',
        (d) => `translate(${xScale(d.sessionId) || 0}, ${yScale(d.topic) || 0})`
      );

    cellGroups
      .append('rect')
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', 7)
      .attr('ry', 7)
      .attr('fill', (d) => (d.score === null ? emptyFill : fillScale(d.score)))
      .attr('stroke', (d) => (d.score === null ? emptyStroke : 'transparent'))
      .attr('stroke-width', 1)
      .attr('opacity', 0)
      .transition()
      .duration(260)
      .delay((_, i) => Math.min(240, i * 6))
      .attr('opacity', 1);

    cellGroups
      .append('text')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (d.score === null ? subLabelColor : textColorScale(d.score)))
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('font-variant-numeric', 'tabular-nums')
      .style('pointer-events', 'none')
      .text((d) => (d.score === null ? '—' : `${d.score}%`));

    cellGroups
      .on('mouseenter', function (event: MouseEvent, d: HeatmapCell) {
        d3.select(this)
          .select('rect')
          .attr('stroke', isDark ? '#93c5fd' : '#1d4ed8')
          .attr('stroke-width', 2);

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setHoveredCell({
            visible: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 10,
            cell: d,
          });
        }
      })
      .on('mousemove', function (event: MouseEvent) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setHoveredCell((prev) => ({
            ...prev,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 10,
          }));
        }
      })
      .on('mouseleave', function (_: MouseEvent, d: HeatmapCell) {
        d3.select(this)
          .select('rect')
          .attr('stroke', d.score === null ? emptyStroke : 'transparent')
          .attr('stroke-width', 1);
        setHoveredCell((prev) => ({ ...prev, visible: false }));
      });
  }, [topics, columns, cells, isDark]);

  if (totalEvaluatedSessions === 0) {
    return (
      <section
        aria-labelledby="skill-topic-heatmap-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-8"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Grid3X3 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2
          id="skill-topic-heatmap-heading"
          className="mt-4 text-lg font-bold text-slate-900 dark:text-white"
        >
          Interview Topic &amp; Skill Heatmap
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-300">
          Complete your first evaluated mock interview to reveal which question topics and technical categories are strongest or need targeted practice.
        </p>
        <Link
          to="/setup"
          className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          Start Mock Interview
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="skill-topic-heatmap-heading"
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      {/* Header & Interactive Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>D3 Topic Matrix</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{topics.length} topics tracked</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Last {columns.length} sessions</span>
          </div>
          <h2
            id="skill-topic-heatmap-heading"
            className="mt-1 text-xl font-bold text-slate-900 dark:text-white"
          >
            Topic Mastery Heatmap
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Spot your strongest interview topics and pinpoint weak categories across recent mock interviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availableSectors.length > 1 && (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(['All', 'Private', 'Government'] as SectorFilter[]).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSectorFilter(sec)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    sectorFilter === sec
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}

          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'weakest', label: 'Weakest First' },
                { id: 'strongest', label: 'Strongest First' },
                { id: 'frequency', label: 'Most Tested' },
              ] as { id: SortMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortMode(opt.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  sortMode === opt.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Strongest vs Weakest Highlights (Flat Divide, No Nested Card Boxes) */}
      {(strongestTopic || weakestTopic) && (
        <div className="grid gap-6 border-b border-slate-100 pb-5 dark:border-slate-800 sm:grid-cols-2 sm:divide-x sm:divide-slate-100 dark:sm:divide-slate-800">
          {strongestTopic && (
            <div className="flex items-start justify-between gap-4 sm:pr-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Strongest Topic</span>
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {strongestTopic.topic}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {strongestTopic.tier} · {strongestTopic.totalQuestions} evaluated{' '}
                  {strongestTopic.totalQuestions === 1 ? 'question' : 'questions'} across{' '}
                  {strongestTopic.sessionsCount} {strongestTopic.sessionsCount === 1 ? 'session' : 'sessions'}
                </p>
              </div>
              <span className="text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                {strongestTopic.averageScore}%
              </span>
            </div>
          )}

          {weakestTopic && (
            <div className="flex items-start justify-between gap-4 sm:pl-6">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Priority Focus Area</span>
                </p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {weakestTopic.topic}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {weakestTopic.tier} · {weakestTopic.averageScore < 80 ? `${80 - weakestTopic.averageScore}% below 80% target` : 'Solid baseline'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`text-2xl font-extrabold tabular-nums ${
                    weakestTopic.averageScore < 55
                      ? 'text-red-600 dark:text-red-400'
                      : weakestTopic.averageScore < 70
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {weakestTopic.averageScore}%
                </span>
                <Link
                  to="/setup"
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  <Flame className="h-3 w-3" aria-hidden="true" />
                  Practice Topic
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* D3 Matrix SVG Canvas */}
      {topics.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No sessions recorded for the {sectorFilter} sector filter.
        </p>
      ) : (
        <div ref={containerRef} className="relative overflow-x-auto">
          <svg
            ref={svgRef}
            role="img"
            aria-label="D3 skill and interview topic mastery heatmap"
            className="mx-auto block h-auto min-w-[640px] w-full overflow-visible"
          />

          {hoveredCell.visible && hoveredCell.cell && (
            <div
              className="pointer-events-none absolute z-30 w-56 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-950"
              style={{
                left: `${Math.max(120, hoveredCell.x)}px`,
                top: `${Math.max(70, hoveredCell.y)}px`,
              }}
            >
              <p className="font-bold text-slate-900 dark:text-white">{hoveredCell.cell.topic}</p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                {hoveredCell.cell.sessionLabel} · {hoveredCell.cell.role} · {hoveredCell.cell.dateStr}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">
                  {hoveredCell.cell.score !== null
                    ? `${hoveredCell.cell.questionCount} ${hoveredCell.cell.questionCount === 1 ? 'question' : 'questions'}`
                    : 'Not tested in session'}
                </span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                  {hoveredCell.cell.score !== null ? `${hoveredCell.cell.score}%` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>Columns represent your chronological evaluated interviews (#1 oldest to latest).</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-red-200 dark:bg-red-900" />
            Needs Focus (&lt;55%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-900" />
            Developing (55–69%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-blue-200 dark:bg-blue-900" />
            Proficient (70–84%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800" />
            Strong (85%+)
          </span>
        </div>
      </div>
    </section>
  );
}
