export interface EligibilityResult {
  eligible: boolean;
  score: number;
  reasons: string[];
  missingSkills: string[];
}

export function calculateEligibility(
  profile: { cgpa: number; skills: string[]; backlogs: number },
  job: { min_cgpa: number | null; required_skills: string[] | null; max_backlogs: number | null }
): EligibilityResult {
  const reasons: string[] = [];
  const missingSkills: string[] = [];
  let score = 0;
  let eligible = true;

  // CGPA check (40% weight)
  const minCgpa = job.min_cgpa ?? 0;
  if (profile.cgpa >= minCgpa) {
    const cgpaScore = minCgpa > 0 ? Math.min((profile.cgpa / minCgpa) * 40, 40) : 40;
    score += cgpaScore;
  } else {
    eligible = false;
    reasons.push(`CGPA ${profile.cgpa} is below minimum ${minCgpa}`);
  }

  // Skills match (40% weight)
  const requiredSkills = job.required_skills ?? [];
  if (requiredSkills.length > 0) {
    const profileSkillsLower = profile.skills.map(s => s.toLowerCase());
    const matched = requiredSkills.filter(s => profileSkillsLower.includes(s.toLowerCase()));
    const missing = requiredSkills.filter(s => !profileSkillsLower.includes(s.toLowerCase()));
    missingSkills.push(...missing);
    const skillScore = (matched.length / requiredSkills.length) * 40;
    score += skillScore;
    if (matched.length < requiredSkills.length * 0.5) {
      reasons.push(`Only ${matched.length}/${requiredSkills.length} required skills matched`);
    }
  } else {
    score += 40;
  }

  // Backlogs check (20% weight)
  const maxBacklogs = job.max_backlogs ?? 99;
  if (profile.backlogs <= maxBacklogs) {
    score += 20;
  } else {
    eligible = false;
    reasons.push(`${profile.backlogs} backlogs exceed maximum ${maxBacklogs}`);
  }

  return { eligible, score: Math.round(score), reasons, missingSkills };
}

export function getEligibilityClass(score: number): string {
  if (score >= 75) return "eligibility-high";
  if (score >= 50) return "eligibility-medium";
  return "eligibility-low";
}
