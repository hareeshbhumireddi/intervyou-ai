import { JobNotification, UserProfile, InterviewSession } from '../types';

export type MatchTier = 'Perfect Match' | 'Strong Match' | 'Good Fit';

export interface JobMatchResult {
  job: JobNotification;
  matchScore: number;            // 0 - 100 percentage
  matchTier: MatchTier;
  isPerfectMatch: boolean;
  matchedSkills: string[];
  resumeMatchedSkills: string[];
  missingSkills: string[];
  primaryReason: string;
  supportingReasons: string[];
  performanceBadge?: string;
  reportSignal?: string;
}

const RESUME_SKILL_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'React', regex: /\breact(\.?js)?\b/i },
  { name: 'Next.js', regex: /\bnext(\.?js)?\b/i },
  { name: 'TypeScript', regex: /\btypescript\b/i },
  { name: 'JavaScript', regex: /\bjavascript\b|\becmascript\b/i },
  { name: 'Tailwind CSS', regex: /\btailwind(\s*css)?\b/i },
  { name: 'Node.js', regex: /\bnode(\.?js)?\b|\bexpress(\.?js)?\b/i },
  { name: 'Java', regex: /\bjava\b(?!script)/i },
  { name: 'Spring Boot', regex: /\bspring(\s*boot)?\b/i },
  { name: 'Microservices', regex: /\bmicroservices?\b/i },
  { name: 'Python', regex: /\bpython\b|\bfastapi\b|\bflask\b/i },
  { name: 'Django', regex: /\bdjango\b/i },
  { name: 'Machine Learning', regex: /\bmachine\s*learning\b|\bscikit-learn\b|\bxgboost\b/i },
  { name: 'Data Science', regex: /\bdata\s*science\b|\bstatistics\b/i },
  { name: 'Data Analysis', regex: /\bdata\s*analys(is|t)\b|\bpower\s*bi\b|\btableau\b/i },
  { name: 'PyTorch', regex: /\bpytorch\b|\btensorflow\b/i },
  { name: 'NLP', regex: /\bnlp\b|\bnatural\s*language\b|\bllm\b|\bgenai\b/i },
  { name: 'AWS', regex: /\baws\b|\bamazon\s*web\s*services\b/i },
  { name: 'GCP', regex: /\bgcp\b|\bgoogle\s*cloud\b/i },
  { name: 'Docker', regex: /\bdocker\b/i },
  { name: 'Kubernetes', regex: /\bkubernetes\b|\bk8s\b/i },
  { name: 'DevOps', regex: /\bdevops\b|\bterraform\b|\bansible\b/i },
  { name: 'CI/CD', regex: /\bci\/?cd\b|\bgithub\s*actions\b|\bjenkins\b/i },
  { name: 'System Design', regex: /\bsystem\s*design\b/i },
  { name: 'Distributed Systems', regex: /\bdistributed\s*systems\b|\bkafka\b/i },
  { name: 'PostgreSQL', regex: /\bpostgres(ql)?\b/i },
  { name: 'SQL', regex: /\bsql\b|\bmysql\b/i },
  { name: 'MongoDB', regex: /\bmongo(db)?\b/i },
  { name: 'Redis', regex: /\bredis\b/i },
  { name: 'Go', regex: /\bgolang\b/i },
  { name: 'Flutter', regex: /\bflutter\b/i },
  { name: 'React Native', regex: /\breact\s*native\b/i },
  { name: 'Android', regex: /\bandroid\b|\bkotlin\b/i },
  { name: 'C++', regex: /\bc\+\+\b/i },
  { name: 'Algorithms', regex: /\balgorithms?\b|\bdata\s*structures\b|\bdsa\b/i },
  { name: 'Figma', regex: /\bfigma\b|\bui\/?ux\b|\buser\s*research\b/i },
  { name: 'Product Strategy', regex: /\bproduct\s*management\b|\broadmap\b|\ba\/b\s*testing\b/i },
  { name: 'Network Security', regex: /\bcyber\s*security\b|\bnetwork\s*security\b|\bcryptography\b|\bsiem\b/i },
  { name: 'Linux', regex: /\blinux\b|\bbash\b/i },
  { name: 'Embedded Systems', regex: /\bembedded\b|\brtos\b|\bfirmware\b/i },
  { name: 'Quantitative Aptitude', regex: /\bquantitative\b|\bfinance\b|\beconomics\b|\bbanking\b/i },
];

/**
 * Parses technical & domain skills directly from uploaded resume text
 */
export function extractSkillsFromResumeText(resumeText?: string): string[] {
  if (!resumeText || !resumeText.trim()) return [];
  const extracted: string[] = [];
  for (const { name, regex } of RESUME_SKILL_PATTERNS) {
    if (regex.test(resumeText)) {
      extracted.push(name);
    }
  }
  return extracted;
}

/**
 * Extracts candidate's composite skill profile combining:
 * 1) Uploaded resume text skills
 * 2) Profile declared skills
 * 3) Completed mock interview roles & performance report strengths
 */
export function extractCandidateSkills(
  user: UserProfile,
  sessions: InterviewSession[],
  resumeTextOverride?: string
): {
  allSkills: string[];
  resumeSkills: string[];
  profileSkills: string[];
  sessionSkills: string[];
} {
  const resumeSkillsSet = new Set<string>();
  const profileSkillsSet = new Set<string>();
  const sessionSkillsSet = new Set<string>();

  // 1. Uploaded resume text
  const effectiveResumeText = resumeTextOverride || user?.resumeText || '';
  extractSkillsFromResumeText(effectiveResumeText).forEach((s) => resumeSkillsSet.add(s));

  // 2. Profile declared skills
  if (user?.skills && Array.isArray(user.skills)) {
    user.skills.forEach((s) => {
      if (s && s.trim()) profileSkillsSet.add(s.trim());
    });
  }

  // 3. Mine skills from completed interview sessions & performance reports
  sessions.forEach((session) => {
    const roleLower = (session.role || '').toLowerCase();
    const catLower = (session.category || '').toLowerCase();

    if (roleLower.includes('react') || catLower.includes('front')) {
      sessionSkillsSet.add('React');
      sessionSkillsSet.add('JavaScript');
      sessionSkillsSet.add('TypeScript');
    }
    if (roleLower.includes('java') || roleLower.includes('spring')) {
      sessionSkillsSet.add('Java');
      sessionSkillsSet.add('Spring Boot');
      sessionSkillsSet.add('Microservices');
    }
    if (roleLower.includes('node') || roleLower.includes('full stack')) {
      sessionSkillsSet.add('Node.js');
      sessionSkillsSet.add('React');
      sessionSkillsSet.add('PostgreSQL');
      sessionSkillsSet.add('TypeScript');
    }
    if (roleLower.includes('python') || roleLower.includes('data') || roleLower.includes('machine learning')) {
      sessionSkillsSet.add('Python');
      sessionSkillsSet.add('Machine Learning');
      sessionSkillsSet.add('SQL');
      sessionSkillsSet.add('Data Analysis');
    }
    if (roleLower.includes('devops') || roleLower.includes('cloud') || roleLower.includes('sre')) {
      sessionSkillsSet.add('AWS');
      sessionSkillsSet.add('Docker');
      sessionSkillsSet.add('Kubernetes');
      sessionSkillsSet.add('CI/CD');
    }
    if (roleLower.includes('product') || roleLower.includes('design')) {
      sessionSkillsSet.add('Product Strategy');
      sessionSkillsSet.add('Figma');
    }
    if (roleLower.includes('cyber') || roleLower.includes('security')) {
      sessionSkillsSet.add('Network Security');
      sessionSkillsSet.add('Linux');
    }
    if (roleLower.includes('scientist') || roleLower.includes('isro') || roleLower.includes('drdo')) {
      sessionSkillsSet.add('C++');
      sessionSkillsSet.add('Algorithms');
      sessionSkillsSet.add('Distributed Systems');
    }

    // Also mine top strengths from performance report skillGapAnalysis (>= 7 out of 10)
    const gapAnalysis = session.overallReport?.skillGapAnalysis;
    if (gapAnalysis) {
      for (const [skillName, rating] of Object.entries(gapAnalysis)) {
        if (typeof rating === 'number' && rating >= 7) {
          sessionSkillsSet.add(skillName);
        }
      }
    }
  });

  const combined = new Set<string>([
    ...resumeSkillsSet,
    ...profileSkillsSet,
    ...sessionSkillsSet,
  ]);

  // Baseline technical skills only if user has neither resume, profile skills, nor sessions
  if (combined.size === 0) {
    ['React', 'TypeScript', 'JavaScript', 'Node.js', 'Problem Solving'].forEach((s) => combined.add(s));
  }

  return {
    allSkills: Array.from(combined),
    resumeSkills: Array.from(resumeSkillsSet),
    profileSkills: Array.from(profileSkillsSet),
    sessionSkills: Array.from(sessionSkillsSet),
  };
}

/**
 * Calculates a match score and personalized reasoning for a job listing
 * integrating uploaded resume skills AND performance report history
 */
export function calculateJobMatch(
  job: JobNotification,
  user: UserProfile,
  sessions: InterviewSession[],
  resumeTextOverride?: string
): JobMatchResult {
  const { allSkills, resumeSkills } = extractCandidateSkills(user, sessions, resumeTextOverride);
  const candidateSkillsLower = allSkills.map((s) => s.toLowerCase());
  const resumeSkillsLower = resumeSkills.map((s) => s.toLowerCase());

  const jobSkills = job.skills || [];
  const jobText = `${job.title} ${job.description || ''} ${job.category || ''} ${job.industry || ''}`.toLowerCase();

  const matchedSkills: string[] = [];
  const resumeMatchedSkills: string[] = [];
  const missingSkills: string[] = [];

  // 1. Direct Job Skill Overlap + Uploaded Resume Skill Overlap
  jobSkills.forEach((js) => {
    const jsLower = js.toLowerCase();
    const isMatched = candidateSkillsLower.some(
      (cs) => cs === jsLower || cs.includes(jsLower) || jsLower.includes(cs)
    );
    const isInResume = resumeSkillsLower.some(
      (rs) => rs === jsLower || rs.includes(jsLower) || jsLower.includes(rs)
    );

    if (isMatched) {
      matchedSkills.push(js);
      if (isInResume) resumeMatchedSkills.push(js);
    } else {
      missingSkills.push(js);
    }
  });

  // Also check if uploaded resume skills appear directly in job title/description even if not listed in job.skills
  resumeSkills.forEach((rs) => {
    const rsLower = rs.toLowerCase();
    if (
      jobText.includes(rsLower) &&
      !matchedSkills.some((m) => m.toLowerCase() === rsLower)
    ) {
      matchedSkills.push(rs);
      resumeMatchedSkills.push(rs);
    }
  });

  let rawScore = 38; // baseline

  // Skill & Resume Match: up to 38 points
  if (jobSkills.length > 0) {
    const overlapRatio = Math.min(1, matchedSkills.length / jobSkills.length);
    rawScore += Math.round(overlapRatio * 32);
    // Bonus for explicit uploaded resume keyword verification
    if (resumeMatchedSkills.length >= 2) rawScore += 8;
    else if (resumeMatchedSkills.length === 1) rawScore += 4;
  } else if (matchedSkills.length > 0) {
    rawScore += Math.min(30, matchedSkills.length * 10);
  } else {
    rawScore += 10;
  }

  // 2. Performance Report History Correlation: up to 24 points
  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' || Boolean(s.overallReport)
  );
  let relatedSession: InterviewSession | null = null;
  let bestRoleScore = 0;

  for (const session of completedSessions) {
    const sessionRole = (session.role || '').toLowerCase();
    const sessionCat = (session.category || '').toLowerCase();
    const jobTitle = job.title.toLowerCase();
    const jobInd = (job.industry || job.category || '').toLowerCase();

    const words = jobTitle.split(/[\s/,()-]+/).filter((w) => w.length > 2);
    const hasTitleOverlap = words.some((w) => sessionRole.includes(w) || sessionCat.includes(w));
    const hasIndustryOverlap =
      (sessionRole.includes('front') && jobInd.includes('software')) ||
      (sessionRole.includes('full stack') && jobInd.includes('software')) ||
      (sessionRole.includes('data') && jobInd.includes('data')) ||
      (sessionRole.includes('cloud') && jobInd.includes('cloud')) ||
      (sessionRole.includes('bank') && jobInd.includes('banking'));

    if (hasTitleOverlap || hasIndustryOverlap) {
      const score = session.overallReport?.overallScore || 70;
      if (score >= bestRoleScore) {
        bestRoleScore = score;
        relatedSession = session;
      }
    }
  }

  // Compute overall candidate performance report metrics across history
  const reportScores = completedSessions
    .map((s) => s.overallReport?.overallScore)
    .filter((v): v is number => typeof v === 'number');
  const avgReportScore =
    reportScores.length > 0
      ? Math.round(reportScores.reduce((a, b) => a + b, 0) / reportScores.length)
      : 0;

  const supportingReasons: string[] = [];
  let performanceBadge: string | undefined;
  let reportSignal: string | undefined;

  if (relatedSession && bestRoleScore > 0) {
    if (bestRoleScore >= 80) {
      rawScore += 22;
      performanceBadge = `Report Score: ${bestRoleScore}%`;
      reportSignal = `${bestRoleScore}% in ${relatedSession.role} report`;
      supportingReasons.push(
        `Strong ${bestRoleScore}% performance report in ${relatedSession.role}`
      );
    } else if (bestRoleScore >= 60) {
      rawScore += 15;
      performanceBadge = `Report Score: ${bestRoleScore}%`;
      reportSignal = `Practiced ${relatedSession.role} (${bestRoleScore}%)`;
      supportingReasons.push(
        `Relevant mock interview report (${bestRoleScore}%) for ${relatedSession.role}`
      );
    } else {
      rawScore += 8;
      reportSignal = `Attempted ${relatedSession.role}`;
      supportingReasons.push(`Practiced related role: ${relatedSession.role}`);
    }
  } else if (avgReportScore >= 75) {
    rawScore += 10;
    reportSignal = `${avgReportScore}% overall interview average`;
    supportingReasons.push(`Consistent ${avgReportScore}% average across performance reports`);
  }

  // 3. Resume & Profile skill breakdown
  if (resumeMatchedSkills.length > 0) {
    supportingReasons.push(
      `Matches ${resumeMatchedSkills.length} resume skill${resumeMatchedSkills.length > 1 ? 's' : ''}: ${resumeMatchedSkills.slice(0, 3).join(', ')}`
    );
  } else if (matchedSkills.length > 0) {
    supportingReasons.push(
      `Matches ${matchedSkills.length} profile skill${matchedSkills.length > 1 ? 's' : ''}: ${matchedSkills.slice(0, 3).join(', ')}`
    );
  }

  // 4. Education qualification bonus
  if (
    user.qualification &&
    job.qualification.toLowerCase().includes(user.qualification.toLowerCase().slice(0, 4))
  ) {
    rawScore += 4;
    supportingReasons.push(`Qualification fit: ${job.qualification}`);
  }

  const finalScore = Math.min(99, Math.max(35, rawScore));

  // Classify Match Tier
  const isPerfectMatch =
    finalScore >= 85 ||
    (finalScore >= 80 && (resumeMatchedSkills.length >= 2 || bestRoleScore >= 80));

  const matchTier: MatchTier = isPerfectMatch
    ? 'Perfect Match'
    : finalScore >= 68
    ? 'Strong Match'
    : 'Good Fit';

  let primaryReason = `Aligned with ${matchedSkills.slice(0, 2).join(' & ') || job.industry || 'your background'}`;
  if (isPerfectMatch && resumeMatchedSkills.length > 0 && reportSignal) {
    primaryReason = `Resume (${resumeMatchedSkills.slice(0, 2).join(', ')}) + ${reportSignal}`;
  } else if (reportSignal && matchedSkills.length > 0) {
    primaryReason = `${reportSignal} • ${matchedSkills.slice(0, 2).join(', ')}`;
  } else if (resumeMatchedSkills.length >= 1) {
    primaryReason = `Matched from uploaded resume: ${resumeMatchedSkills.slice(0, 3).join(', ')}`;
  } else if (matchedSkills.length >= 1) {
    primaryReason = `${matchedSkills.length} matching skill${matchedSkills.length > 1 ? 's' : ''} (${matchedSkills.slice(0, 3).join(', ')})`;
  }

  return {
    job,
    matchScore: finalScore,
    matchTier,
    isPerfectMatch,
    matchedSkills,
    resumeMatchedSkills,
    missingSkills,
    primaryReason,
    supportingReasons,
    performanceBadge,
    reportSignal,
  };
}

/**
 * Prioritizes all job listings descending by profile, uploaded resume skills,
 * and performance report compatibility.
 */
export function prioritizeJobsByProfile(
  jobs: JobNotification[],
  user: UserProfile,
  sessions: InterviewSession[],
  resumeTextOverride?: string
): JobMatchResult[] {
  if (!jobs || jobs.length === 0) return [];

  const scored = jobs.map((job) =>
    calculateJobMatch(job, user, sessions, resumeTextOverride)
  );

  scored.sort((a, b) => {
    if (a.isPerfectMatch !== b.isPerfectMatch) {
      return a.isPerfectMatch ? -1 : 1;
    }
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return b.matchedSkills.length - a.matchedSkills.length;
  });

  return scored;
}

/**
 * Ranks all available jobs and returns top suggested jobs personalized for the user
 */
export function getSuggestedJobs(
  jobs: JobNotification[],
  user: UserProfile,
  sessions: InterviewSession[],
  limit = 3,
  resumeTextOverride?: string
): JobMatchResult[] {
  return prioritizeJobsByProfile(jobs, user, sessions, resumeTextOverride).slice(0, limit);
}
