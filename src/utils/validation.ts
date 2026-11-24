/**
 * Client-side validation. These rules mirror backend/validators.py exactly so the
 * user gets instant feedback; the backend still enforces every rule independently.
 * Each validator returns an error message, or '' when the value is valid.
 */

export const LANGUAGES = ['English', 'Telugu', 'Hindi'] as const;
export const DEGREES = ['B.Tech', 'B.Sc', 'MBA', 'Other'] as const;
export const GENDERS = ['Male', 'Female', 'Other'] as const;
export const MIN_GRADUATION_YEAR = 1970;
export const FUTURE_GRADUATION_YEARS = 8;

const maxGraduationYear = (today = new Date()) => today.getFullYear() + FUTURE_GRADUATION_YEARS;
const collapse = (v: string) => v.replace(/\s+/g, ' ').trim();

export function validateName(value: string): string {
  const name = collapse(value);
  if (!name) return 'Enter your full name.';
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 100) return 'Name must be 100 characters or fewer.';
  if (!/^[\p{L}\p{M}' \u2019.-]+$/u.test(name)) return 'Name can only contain letters, spaces, apostrophes, hyphens and periods.';
  if ((name.match(/\p{L}/gu) || []).length < 2) return 'Name must contain at least two letters.';
  return '';
}

export function validateEmail(value: string): string {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (email.length > 254) return 'Email address is too long.';
  // Deliberately permissive (the server does the authoritative check): one @, a
  // non-empty local part, and a dotted domain. Allows international characters.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/u.test(email)) return 'Enter a valid email address, for example name@example.com.';
  return '';
}

export function validateMobile(value: string): string {
  const mobile = value.trim();
  if (!mobile) return 'Enter your 10-digit mobile number.';
  if (!/^[0-9]+$/.test(mobile)) return 'Mobile number must contain digits only (no spaces, +91 or symbols).';
  if (mobile.length !== 10) return 'Mobile number must be exactly 10 digits.';
  if (!/^[6-9]/.test(mobile)) return 'Enter a valid Indian mobile number starting with 6, 7, 8 or 9.';
  return '';
}

export function validateLanguage(value: string): string {
  if (!value) return 'Select your preferred language.';
  if (!(LANGUAGES as readonly string[]).includes(value)) return `Select one of the supported languages: ${LANGUAGES.join(', ')}.`;
  return '';
}

export function validateDob(value: string, today = new Date()): string {
  if (!value) return 'Enter your date of birth.';
  const parts = value.split('-');
  if (parts.length !== 3) return 'Enter a complete date of birth (Day, Month, Year).';
  const [yStr, mStr, dStr] = parts;
  if (!yStr || !mStr || !dStr || mStr === '00' || dStr === '00') {
    return 'Enter a complete date of birth (Day, Month, Year).';
  }

  if (!/^\d+$/.test(yStr) || yStr.length !== 4) {
    return 'Year of birth must be exactly 4 digits (e.g. 1998).';
  }
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  if (y < 1900) return 'Year of birth cannot be earlier than 1900.';
  if (y > today.getFullYear()) return 'Date of birth cannot be in the future.';
  if (m < 1 || m > 12) return 'Select a valid month (01–12).';
  if (d < 1 || d > 31) return 'Select a valid day (01–31).';

  const born = new Date(y, m - 1, d);
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d) {
    return 'Enter a valid calendar date.';
  }
  if (born > today) return 'Date of birth cannot be in the future.';

  let age = today.getFullYear() - y;
  if (today.getMonth() < m - 1 || (today.getMonth() === m - 1 && today.getDate() < d)) age -= 1;
  if (age < 13) return 'You must be at least 13 years old to register.';
  if (age > 100) return 'Enter a valid date of birth (maximum age is 100).';
  return '';
}

export function validateGender(value: string): string {
  return !value || (GENDERS as readonly string[]).includes(value) ? '' : 'Select a valid option.';
}

export function validateDegree(value: string): string {
  if (!value) return 'Select your degree.';
  return (DEGREES as readonly string[]).includes(value) ? '' : 'Select a valid degree.';
}

export function validateGraduationYear(value: string, today = new Date()): string {
  const year = value.trim();
  const upper = maxGraduationYear(today);
  if (!year) return 'Enter your graduation (passing) year.';
  if (!/^[0-9]{4}$/.test(year)) return 'Graduation year must be exactly 4 digits (e.g. 2025).';
  const n = Number(year);
  if (n < MIN_GRADUATION_YEAR || n > upper) return `Year must be between ${MIN_GRADUATION_YEAR} and ${upper}.`;
  return '';
}

export function validateCgpa(value: string): string {
  const cgpa = value.trim();
  if (!cgpa) return '';
  if (!/^[0-9]{1,3}(\.[0-9]{1,2})?$/.test(cgpa) || Number(cgpa) > 100) return 'Enter a number between 0 and 100, for example 8.5.';
  return '';
}

export function validateFreeText(value: string, label: string, required = false, max = 150): string {
  const text = collapse(value);
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  if (!text) return required ? `Enter your ${label}.` : '';
  if (text.length > max) return `${cap} must be ${max} characters or fewer.`;
  if (!/\p{L}/u.test(text)) return `Enter a valid ${label}.`;
  if (!/^[\p{L}\p{M}\p{N} .,&()'\u2019/+#:-]+$/u.test(text)) return `${cap} contains characters that are not allowed.`;
  return '';
}

export function validatePassword(value: string, email = ''): string {
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (value.length > 128) return 'Password must be 128 characters or fewer.';
  if (!value.trim()) return 'Password cannot be only spaces.';
  if (email && value.toLowerCase() === email.trim().toLowerCase()) return 'Password must not be the same as your email address.';
  return '';
}

export type FieldErrors = Record<string, string>;

export type RegistrationValues = {
  fullName: string; dob: string; gender: string; email: string; mobile: string; address: string;
  preferredLanguage: string; qualification: string; password: string; confirmPassword: string;
  degree: string; college: string; specialization: string; graduationYear: string; cgpa: string;
};

/** Fields that belong to each of the three registration steps. */
export const STEP_FIELDS: Record<1 | 2 | 3, (keyof RegistrationValues)[]> = {
  1: ['fullName', 'dob', 'gender'],
  2: ['email', 'mobile', 'address', 'preferredLanguage', 'password', 'confirmPassword'],
  3: ['degree', 'college', 'specialization', 'graduationYear', 'cgpa', 'qualification'],
};

export function validateField(field: keyof RegistrationValues, v: RegistrationValues): string {
  switch (field) {
    case 'fullName': return validateName(v.fullName);
    case 'dob': return validateDob(v.dob);
    case 'gender': return validateGender(v.gender);
    case 'email': return validateEmail(v.email);
    case 'mobile': return validateMobile(v.mobile);
    case 'address': return v.address.length > 500 ? 'Address must be 500 characters or fewer.' : '';
    case 'preferredLanguage': return validateLanguage(v.preferredLanguage);
    case 'password': return validatePassword(v.password, v.email);
    case 'confirmPassword': return v.confirmPassword !== v.password ? 'Passwords do not match.' : '';
    case 'degree': return validateDegree(v.degree);
    case 'college': return validateFreeText(v.college, 'college name', true);
    case 'specialization': return validateFreeText(v.specialization, 'specialization');
    case 'graduationYear': return validateGraduationYear(v.graduationYear);
    case 'cgpa': return validateCgpa(v.cgpa);
    case 'qualification': return validateFreeText(v.qualification, 'highest qualification');
  }
}

export function validateFields(fields: (keyof RegistrationValues)[], v: RegistrationValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields) {
    const message = validateField(f, v);
    if (message) errors[f] = message;
  }
  return errors;
}

/** Only allow same-origin relative redirect targets (blocks open redirects). */
export function safeRedirect(target: unknown, fallback = '/dashboard'): string {
  if (typeof target !== 'string') return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return fallback;
  if (['/login', '/onboarding', '/'].includes(target.split('?')[0])) return fallback;
  return target;
}
