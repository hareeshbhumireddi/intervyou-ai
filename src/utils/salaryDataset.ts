import { JobNotification } from '../types';

export interface SalaryRange {
  minLPA: number;
  medianLPA: number;
  maxLPA: number;
  topLPA: number;
  formattedRange: string;
  formattedMedian: string;
  breakdown: {
    basePercent: number;
    bonusPercent: number;
    equityPercent: number;
    baseLPA: string;
    bonusLPA: string;
    equityLPA: string;
  };
  demandLevel: 'Very High' | 'High' | 'Moderate';
  sampleCompanies: string[];
  locationAdjustment: string;
  roleCategory: string;
  experienceBracket: string;
}

export interface RoleSalaryBenchmark {
  roleKeywords: string[];
  category: string;
  brackets: {
    entry: { min: number; median: number; max: number; top: number };    // 0-2 yrs
    mid: { min: number; median: number; max: number; top: number };      // 2-5 yrs
    senior: { min: number; median: number; max: number; top: number };   // 5-8 yrs
    lead: { min: number; median: number; max: number; top: number };     // 8-12+ yrs
  };
  topCompanies: string[];
  demand: 'Very High' | 'High' | 'Moderate';
}

/**
 * Public benchmark compensation dataset based on Indian Tech and Industry Compensation Reports
 * (aggregating public salary benchmarks for tech hubs: Bengaluru, Hyderabad, Pune, Mumbai, Delhi NCR, Remote)
 */
export const SALARY_BENCHMARK_DATASET: RoleSalaryBenchmark[] = [
  {
    roleKeywords: ['frontend', 'react', 'next.js', 'vue', 'angular', 'ui developer', 'web developer'],
    category: 'Frontend Engineering',
    brackets: {
      entry: { min: 6.5, median: 9.5, max: 14.0, top: 18.0 },
      mid: { min: 14.0, median: 22.0, max: 32.0, top: 40.0 },
      senior: { min: 28.0, median: 38.0, max: 52.0, top: 68.0 },
      lead: { min: 42.0, median: 56.0, max: 75.0, top: 95.0 },
    },
    topCompanies: ['Google', 'Microsoft', 'Uber', 'Swiggy', 'Razorpay', 'Flipkart'],
    demand: 'Very High',
  },
  {
    roleKeywords: ['backend', 'java', 'spring', 'go', 'golang', 'node', 'microservices', 'c++'],
    category: 'Backend Engineering',
    brackets: {
      entry: { min: 7.0, median: 10.5, max: 16.0, top: 22.0 },
      mid: { min: 16.0, median: 24.5, max: 36.0, top: 46.0 },
      senior: { min: 32.0, median: 44.0, max: 58.0, top: 76.0 },
      lead: { min: 48.0, median: 64.0, max: 88.0, top: 115.0 },
    },
    topCompanies: ['Amazon', 'Google', 'PhonePe', 'CRED', 'Flipkart', 'Atlassian'],
    demand: 'Very High',
  },
  {
    roleKeywords: ['full stack', 'sde', 'software engineer', 'software development engineer'],
    category: 'Full Stack Engineering',
    brackets: {
      entry: { min: 7.0, median: 10.0, max: 15.5, top: 20.0 },
      mid: { min: 15.0, median: 23.0, max: 34.0, top: 44.0 },
      senior: { min: 30.0, median: 42.0, max: 55.0, top: 72.0 },
      lead: { min: 45.0, median: 60.0, max: 82.0, top: 105.0 },
    },
    topCompanies: ['Microsoft', 'Salesforce', 'Zomato', 'Adobe', 'Intuit', 'Uber'],
    demand: 'Very High',
  },
  {
    roleKeywords: ['data scientist', 'machine learning', 'ai engineer', 'nlp', 'deep learning', 'data science'],
    category: 'AI & Data Science',
    brackets: {
      entry: { min: 8.0, median: 12.0, max: 18.0, top: 25.0 },
      mid: { min: 18.0, median: 28.0, max: 40.0, top: 52.0 },
      senior: { min: 35.0, median: 48.0, max: 65.0, top: 85.0 },
      lead: { min: 52.0, median: 72.0, max: 98.0, top: 130.0 },
    },
    topCompanies: ['Google DeepMind', 'Amazon AWS', 'Flipkart', 'Myntra', 'Fractal', 'Tiger Analytics'],
    demand: 'Very High',
  },
  {
    roleKeywords: ['devops', 'sre', 'cloud', 'site reliability', 'kubernetes', 'aws', 'infrastructure', 'platform engineer'],
    category: 'DevOps & Cloud SRE',
    brackets: {
      entry: { min: 7.0, median: 10.0, max: 15.0, top: 20.0 },
      mid: { min: 15.0, median: 23.5, max: 35.0, top: 45.0 },
      senior: { min: 30.0, median: 42.0, max: 56.0, top: 74.0 },
      lead: { min: 46.0, median: 62.0, max: 85.0, top: 110.0 },
    },
    topCompanies: ['Cisco', 'Amazon AWS', 'Oracle', 'Red Hat', 'Salesforce', 'Jio'],
    demand: 'Very High',
  },
  {
    roleKeywords: ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin'],
    category: 'Mobile Engineering',
    brackets: {
      entry: { min: 6.5, median: 9.5, max: 14.5, top: 18.5 },
      mid: { min: 14.5, median: 22.5, max: 33.0, top: 42.0 },
      senior: { min: 28.0, median: 39.0, max: 52.0, top: 68.0 },
      lead: { min: 40.0, median: 55.0, max: 74.0, top: 95.0 },
    },
    topCompanies: ['Swiggy', 'Zomato', 'CRED', 'Ola', 'Paytm', 'ShareChat'],
    demand: 'High',
  },
  {
    roleKeywords: ['qa', 'test', 'automation', 'sdet', 'quality assurance'],
    category: 'Quality Assurance & SDET',
    brackets: {
      entry: { min: 5.0, median: 7.5, max: 11.0, top: 15.0 },
      mid: { min: 11.0, median: 16.5, max: 24.0, top: 32.0 },
      senior: { min: 22.0, median: 30.0, max: 40.0, top: 52.0 },
      lead: { min: 32.0, median: 44.0, max: 60.0, top: 75.0 },
    },
    topCompanies: ['Thoughtworks', 'Accenture', 'TCS', 'Amazon', 'Qualcomm', 'Adobe'],
    demand: 'High',
  },
  {
    roleKeywords: ['product manager', 'associate product manager', 'apm', 'pm', 'technical product manager'],
    category: 'Product Management',
    brackets: {
      entry: { min: 9.0, median: 14.0, max: 20.0, top: 26.0 },
      mid: { min: 20.0, median: 30.0, max: 45.0, top: 60.0 },
      senior: { min: 38.0, median: 52.0, max: 72.0, top: 95.0 },
      lead: { min: 55.0, median: 75.0, max: 110.0, top: 150.0 },
    },
    topCompanies: ['Google', 'Microsoft', 'Flipkart', 'Swiggy', 'Razorpay', 'Paytm'],
    demand: 'Very High',
  },
  {
    roleKeywords: ['scientist', 'isro', 'drdo', 'bank', 'po', 'probationary', 'specialist officer', 'sbi', 'rbi', 'govt', 'public sector'],
    category: 'Government & Public Sector (PSU)',
    brackets: {
      entry: { min: 8.5, median: 11.0, max: 14.0, top: 16.5 },
      mid: { min: 12.0, median: 15.5, max: 19.5, top: 23.0 },
      senior: { min: 18.0, median: 22.5, max: 28.0, top: 34.0 },
      lead: { min: 25.0, median: 32.0, max: 40.0, top: 48.0 },
    },
    topCompanies: ['ISRO', 'DRDO', 'State Bank of India (SBI)', 'Reserve Bank of India (RBI)', 'BHEL', 'IOCL'],
    demand: 'Moderate',
  },
];

/**
 * City cost of living & compensation multipliers across India tech hubs
 */
export const CITY_COMPENSATION_MULTIPLIERS: Record<string, { multiplier: number; label: string }> = {
  'bengaluru': { multiplier: 1.15, label: 'Bengaluru (Tier 1 Tech Hub +15%)' },
  'bangalore': { multiplier: 1.15, label: 'Bengaluru (Tier 1 Tech Hub +15%)' },
  'mumbai': { multiplier: 1.12, label: 'Mumbai (Finance & Tech Hub +12%)' },
  'hyderabad': { multiplier: 1.08, label: 'Hyderabad (Cyberabad Hub +8%)' },
  'delhi': { multiplier: 1.06, label: 'Delhi NCR (Capital Region +6%)' },
  'gurugram': { multiplier: 1.08, label: 'Gurugram / NCR (+8%)' },
  'noida': { multiplier: 1.05, label: 'Noida / NCR (+5%)' },
  'pune': { multiplier: 1.03, label: 'Pune (IT Hub +3%)' },
  'chennai': { multiplier: 1.02, label: 'Chennai (SaaS Hub +2%)' },
  'remote': { multiplier: 1.08, label: 'Pan-India Remote (+8%)' },
  'india': { multiplier: 1.00, label: 'All India Baseline (National Average)' },
};

/**
 * Maps input string to experience bracket
 */
function resolveExperienceBracket(expStr = ''): 'entry' | 'mid' | 'senior' | 'lead' {
  const lower = expStr.toLowerCase();
  if (lower.includes('lead') || lower.includes('principal') || lower.includes('architect') || lower.includes('8+') || lower.includes('10+')) {
    return 'lead';
  }
  if (lower.includes('senior') || lower.includes('sr.') || lower.includes('3-6') || lower.includes('4-7') || lower.includes('5-8') || lower.includes('5+')) {
    return 'senior';
  }
  if (lower.includes('fresher') || lower.includes('intern') || lower.includes('0-1') || lower.includes('0-2') || lower.includes('entry')) {
    return 'entry';
  }
  return 'mid'; // default 2-5 years
}

/**
 * Computes estimated salary range and distribution for a given role, location, and experience
 */
export function estimateSalary(role: string, location = 'India', experience = '2-5 Years'): SalaryRange {
  const cleanRole = (role || 'Software Engineer').toLowerCase();
  const cleanLoc = (location || 'India').toLowerCase();

  // Find matching benchmark
  let matchedBenchmark = SALARY_BENCHMARK_DATASET.find(b => 
    b.roleKeywords.some(kw => cleanRole.includes(kw))
  );

  if (!matchedBenchmark) {
    matchedBenchmark = SALARY_BENCHMARK_DATASET[2]; // Default to Full Stack Engineering
  }

  // Find city multiplier
  let cityInfo = { multiplier: 1.0, label: 'All India Baseline' };
  for (const [key, val] of Object.entries(CITY_COMPENSATION_MULTIPLIERS)) {
    if (cleanLoc.includes(key)) {
      cityInfo = val;
      break;
    }
  }

  const bracketKey = resolveExperienceBracket(experience);
  const baseRange = matchedBenchmark.brackets[bracketKey];

  const minLPA = Math.round((baseRange.min * cityInfo.multiplier) * 10) / 10;
  const medianLPA = Math.round((baseRange.median * cityInfo.multiplier) * 10) / 10;
  const maxLPA = Math.round((baseRange.max * cityInfo.multiplier) * 10) / 10;
  const topLPA = Math.round((baseRange.top * cityInfo.multiplier) * 10) / 10;

  // Breakdown standard for tech in India: ~80-85% base, 10% variable bonus, 5-10% equity
  const isGovt = matchedBenchmark.category.includes('Government');
  const basePercent = isGovt ? 90 : 82;
  const bonusPercent = isGovt ? 10 : 12;
  const equityPercent = isGovt ? 0 : 6;

  const baseLPA = `₹${(medianLPA * (basePercent / 100)).toFixed(1)} LPA`;
  const bonusLPA = `₹${(medianLPA * (bonusPercent / 100)).toFixed(1)} LPA`;
  const equityLPA = equityPercent > 0 ? `₹${(medianLPA * (equityPercent / 100)).toFixed(1)} LPA (ESOPs)` : 'N/A (Govt Allowance)';

  const bracketLabels: Record<string, string> = {
    entry: 'Entry Level (0-2 Yrs)',
    mid: 'Mid-Level (2-5 Yrs)',
    senior: 'Senior Level (5-8 Yrs)',
    lead: 'Staff / Tech Lead (8+ Yrs)',
  };

  return {
    minLPA,
    medianLPA,
    maxLPA,
    topLPA,
    formattedRange: `₹${minLPA} - ₹${maxLPA} LPA`,
    formattedMedian: `₹${medianLPA} LPA`,
    breakdown: {
      basePercent,
      bonusPercent,
      equityPercent,
      baseLPA,
      bonusLPA,
      equityLPA,
    },
    demandLevel: matchedBenchmark.demand,
    sampleCompanies: matchedBenchmark.topCompanies,
    locationAdjustment: cityInfo.label,
    roleCategory: matchedBenchmark.category,
    experienceBracket: bracketLabels[bracketKey],
  };
}

/**
 * Convenient helper to get salary estimate directly for any JobNotification object
 */
export function getJobSalaryEstimate(job: JobNotification): SalaryRange {
  return estimateSalary(job.title, job.location, job.experience);
}
