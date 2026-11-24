export const PLACEHOLDER_AVATARS = {
  candidateMale: '/src/assets/images/avatar_candidate_one_1794488416268.jpg',
  candidateFemale: '/src/assets/images/avatar_candidate_two_1794488417182.jpg',
  default: '/src/assets/images/avatar_candidate_one_1794488416268.jpg',
};

export const COMPANY_LOGOS = {
  tech: '/src/assets/images/company_tech_logo_1794488417113.jpg',
  cloud: '/src/assets/images/company_cloud_logo_1794488417690.jpg',
  institution: '/src/assets/images/company_finance_logo_1794488418587.jpg',
};

/**
 * Returns an appropriate professional company logo based on company name and sector.
 */
export function getCompanyLogo(company: string, sector?: string): string {
  const comp = (company || '').toLowerCase();
  if (
    comp.includes('sbi') ||
    comp.includes('upsc') ||
    comp.includes('ssc') ||
    comp.includes('bank') ||
    comp.includes('gov') ||
    comp.includes('rbi') ||
    comp.includes('appsc') ||
    comp.includes('tspsc') ||
    sector === 'Government'
  ) {
    return COMPANY_LOGOS.institution;
  }

  if (
    comp.includes('amazon') ||
    comp.includes('isro') ||
    comp.includes('cloud') ||
    comp.includes('data') ||
    comp.includes('azure') ||
    comp.includes('ai')
  ) {
    return COMPANY_LOGOS.cloud;
  }

  return COMPANY_LOGOS.tech;
}

/**
 * Returns a candidate profile picture, alternating based on index or user preferences.
 */
export function getCandidateAvatar(index = 0, gender?: string): string {
  if (gender?.toLowerCase() === 'female') {
    return PLACEHOLDER_AVATARS.candidateFemale;
  }
  if (gender?.toLowerCase() === 'male') {
    return PLACEHOLDER_AVATARS.candidateMale;
  }
  return index % 2 === 0
    ? PLACEHOLDER_AVATARS.candidateMale
    : PLACEHOLDER_AVATARS.candidateFemale;
}
