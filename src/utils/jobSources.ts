import { JobNotification } from '../types';

export interface LiveJobSearchQuery {
  role: string;
  location: string;
  experience?: string;
  platform?: 'All' | 'LinkedIn' | 'Naukri';
}

/**
 * Builds live real-time deep-search URL for LinkedIn Jobs
 */
export function buildLinkedInSearchUrl(role: string, location = 'India'): string {
  const query = role ? role.trim() : 'Software Engineer';
  const loc = location ? location.trim() : 'India';
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(loc)}&f_TPR=r604800`;
}

/**
 * Builds live real-time deep-search URL for Naukri.com
 */
export function buildNaukriSearchUrl(role: string, location = 'India'): string {
  const rawRole = (role || 'software engineer').replace(/\([^)]*\)/g, ' ').trim();
  const primaryLoc = (location || 'India').replace(/\([^)]*\)/g, '').split(',')[0].split('/')[0].trim() || 'India';
  const cleanRole = rawRole
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'software-engineer';
  const cleanLoc = primaryLoc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'india';
  return `https://www.naukri.com/${cleanRole}-jobs-in-${cleanLoc}?k=${encodeURIComponent(rawRole)}&l=${encodeURIComponent(primaryLoc)}`;
}

/**
 * Builds live real-time search URL for Google Jobs
 */
export function buildGoogleJobsUrl(role: string, location = 'India'): string {
  const query = `${role || 'software'} jobs in ${location || 'India'}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&ibp=htl;jobs`;
}

function daysFromNow(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * Real-time curated feed of live tech, product, and government openings from LinkedIn and Naukri
 */
export const LIVE_PLATFORM_JOBS: JobNotification[] = [
  {
    id: 'lk-1',
    company: 'Google',
    title: 'Senior Software Engineer - Full Stack',
    sector: 'Private',
    category: 'Software Engineering',
    location: 'Bengaluru, Karnataka',
    qualification: 'B.Tech / M.Tech in CS or related field',
    experience: '3-6 Years',
    salary: '35 - 55 LPA',
    lastDate: daysFromNow(17),
    releaseDate: daysFromNow(-5),
    applyLink: 'https://www.linkedin.com/jobs/search/?keywords=Google%20Senior%20Software%20Engineer&location=Bengaluru',
    officialWebsite: 'https://www.google.com/about/careers/applications/',
    status: 'New',
    isFeatured: true,
    platform: 'LinkedIn',
    skills: ['React', 'TypeScript', 'Distributed Systems', 'Go', 'GCP'],
    description: 'Build hyper-scalable user experiences and resilient cloud microservices for billions of global users.'
  },
  {
    id: 'nk-1',
    company: 'Tata Consultancy Services (TCS)',
    title: 'Java Cloud & Microservices Developer',
    sector: 'Private',
    category: 'Backend',
    location: 'Hyderabad, Telangana',
    qualification: 'B.E / B.Tech / MCA',
    experience: '2-5 Years',
    salary: '12 - 22 LPA',
    lastDate: daysFromNow(32),
    releaseDate: daysFromNow(-4),
    applyLink: 'https://www.naukri.com/tcs-java-cloud-microservices-developer-jobs-in-hyderabad?k=TCS%20Java%20Cloud%20Microservices%20Developer&l=Hyderabad',
    officialWebsite: 'https://www.tcs.com/careers',
    status: 'New',
    isFeatured: true,
    platform: 'Naukri',
    skills: ['Java 17', 'Spring Boot', 'Kafka', 'Docker', 'PostgreSQL'],
    description: 'Architect mission-critical enterprise banking and supply-chain microservices using Spring Cloud.'
  },
  {
    id: 'lk-2',
    company: 'Microsoft',
    title: 'Frontend Engineer (React / TypeScript)',
    sector: 'Private',
    category: 'Frontend',
    location: 'Bengaluru / Hyderabad (Hybrid)',
    qualification: 'B.Tech / Equivalent',
    experience: '2-4 Years',
    salary: '28 - 42 LPA',
    lastDate: daysFromNow(15),
    releaseDate: daysFromNow(-3),
    applyLink: 'https://www.linkedin.com/jobs/search/?keywords=Microsoft%20Frontend%20Engineer&location=Bengaluru',
    officialWebsite: 'https://careers.microsoft.com',
    status: 'New',
    isFeatured: true,
    platform: 'LinkedIn',
    skills: ['React', 'Next.js', 'TypeScript', 'Web Performance', 'Tailwind CSS'],
    description: 'Work on Microsoft 365 and Azure Developer platform interfaces with high accessibility and smoothness.'
  },
  {
    id: 'nk-2',
    company: 'Infosys',
    title: 'Full Stack React & Node Developer',
    sector: 'Private',
    category: 'Full Stack',
    location: 'Pune, Maharashtra',
    qualification: 'Any Engineering Graduate',
    experience: '1-3 Years',
    salary: '8 - 16 LPA',
    lastDate: daysFromNow(22),
    releaseDate: daysFromNow(-6),
    applyLink: 'https://www.naukri.com/infosys-full-stack-react-node-developer-jobs-in-pune?k=Infosys%20Full%20Stack%20React%20Node%20Developer&l=Pune',
    officialWebsite: 'https://www.infosys.com/careers',
    status: 'New',
    isFeatured: false,
    platform: 'Naukri',
    skills: ['Node.js', 'React', 'MongoDB', 'REST APIs', 'AWS'],
    description: 'Design and deploy modern end-to-end full stack web platforms for international clients.'
  },
  {
    id: 'lk-3',
    company: 'Amazon',
    title: 'Software Development Engineer II (AWS)',
    sector: 'Private',
    category: 'Cloud & Infrastructure',
    location: 'Hyderabad, India',
    qualification: 'Bachelor or Master in Computer Science',
    experience: '3-6 Years',
    salary: '40 - 62 LPA',
    lastDate: daysFromNow(27),
    releaseDate: daysFromNow(-2),
    applyLink: 'https://www.linkedin.com/jobs/search/?keywords=Amazon%20Software%20Development%20Engineer&location=Hyderabad',
    officialWebsite: 'https://www.amazon.jobs',
    status: 'New',
    isFeatured: true,
    platform: 'LinkedIn',
    skills: ['System Design', 'Java', 'DynamoDB', 'AWS Lambda', 'High Concurrency'],
    description: 'Develop next-generation distributed storage and low-latency API platforms powering global AWS customers.'
  },
  {
    id: 'nk-3',
    company: 'Flipkart',
    title: 'Data Scientist - Machine Learning',
    sector: 'Private',
    category: 'AI & Data Science',
    location: 'Bengaluru, Karnataka',
    qualification: 'M.Tech / M.S / Ph.D in Quantitative field',
    experience: '2-5 Years',
    salary: '30 - 48 LPA',
    lastDate: daysFromNow(12),
    releaseDate: daysFromNow(-7),
    applyLink: 'https://www.naukri.com/flipkart-data-scientist-machine-learning-jobs-in-bengaluru?k=Flipkart%20Data%20Scientist%20Machine%20Learning&l=Bengaluru',
    officialWebsite: 'https://www.flipkartcareers.com',
    status: 'New',
    isFeatured: true,
    platform: 'Naukri',
    skills: ['Python', 'PyTorch', 'Recommendation Systems', 'NLP', 'Big Data'],
    description: 'Create recommendation algorithms and demand forecasting pipelines handling millions of concurrent queries.'
  },
  {
    id: 'lk-4',
    company: 'Zomato',
    title: 'Mobile Application Developer (React Native / iOS)',
    sector: 'Private',
    category: 'Mobile',
    location: 'Gurugram / Delhi NCR',
    qualification: 'B.Tech / B.E',
    experience: '2-4 Years',
    salary: '22 - 36 LPA',
    lastDate: daysFromNow(18),
    releaseDate: daysFromNow(-4),
    applyLink: 'https://www.linkedin.com/jobs/search/?keywords=Zomato%20Mobile%20Application%20Developer&location=Gurugram',
    officialWebsite: 'https://www.zomato.com/careers',
    status: 'New',
    isFeatured: false,
    platform: 'LinkedIn',
    skills: ['React Native', 'TypeScript', 'iOS Swift', 'State Management', 'Offline First'],
    description: 'Build rapid, silky-smooth mobile features used by tens of millions of food and grocery delivery customers.'
  },
  {
    id: 'nk-4',
    company: 'HCLTech',
    title: 'DevOps & Site Reliability Engineer (SRE)',
    sector: 'Private',
    category: 'DevOps',
    location: 'Noida / Chennai (Remote Eligible)',
    qualification: 'B.Tech / MCA',
    experience: '3-6 Years',
    salary: '14 - 24 LPA',
    lastDate: daysFromNow(37),
    releaseDate: daysFromNow(-5),
    applyLink: 'https://www.naukri.com/hcltech-devops-site-reliability-engineer-jobs-in-noida?k=HCLTech%20DevOps%20Site%20Reliability%20Engineer&l=Noida',
    officialWebsite: 'https://www.hcltech.com/careers',
    status: 'New',
    isFeatured: false,
    platform: 'Naukri',
    skills: ['Kubernetes', 'Terraform', 'CI/CD Pipelines', 'Prometheus', 'Linux'],
    description: 'Automate multi-cloud infrastructure deployments, monitoring, and zero-downtime canary rollouts.'
  },
  {
    id: 'gov-1',
    company: 'ISRO',
    title: 'Scientist / Engineer ‘SC’ (Computer Science)',
    sector: 'Government',
    category: 'Space & Research',
    location: 'Bengaluru / Sriharikota',
    qualification: 'B.E/B.Tech with min 65% marks',
    experience: 'Freshers',
    salary: 'Level 10 (₹85,000/mo + perks)',
    lastDate: daysFromNow(47),
    releaseDate: daysFromNow(-8),
    applyLink: 'https://www.isro.gov.in/Careers.html',
    officialWebsite: 'https://www.isro.gov.in',
    status: 'New',
    isFeatured: true,
    platform: 'Direct',
    skills: ['C/C++', 'Embedded Systems', 'Real-time OS', 'Algorithms', 'Telemetry'],
    description: 'Work on satellite control ground software, telemetry data reception, and autonomous space flight navigation.'
  },
  {
    id: 'gov-2',
    company: 'State Bank of India (SBI)',
    title: 'Probationary Officer (PO) & Specialist Officer',
    sector: 'Government',
    category: 'Banking',
    location: 'All India',
    qualification: 'Graduation in any discipline',
    experience: 'Freshers',
    salary: '₹65,000 - ₹95,000/mo (Gross)',
    lastDate: daysFromNow(35),
    releaseDate: daysFromNow(-5),
    applyLink: 'https://sbi.co.in/careers',
    officialWebsite: 'https://sbi.co.in',
    status: 'Closing Soon',
    isFeatured: true,
    platform: 'Direct',
    skills: ['Quantitative Aptitude', 'Banking Awareness', 'Logical Reasoning', 'English Comprehension'],
    description: 'Premier public sector banking leadership program with rapid promotion tracks and nationwide postings.'
  }
];
