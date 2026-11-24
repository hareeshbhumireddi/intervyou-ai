import { describe, expect, it } from 'vitest';
import {
  safeRedirect, validateCgpa, validateDob, validateEmail, validateGraduationYear,
  validateLanguage, validateMobile, validateName, validatePassword,
} from '../validation';

const ok = (msg: string) => msg === '';
const NOW = new Date(2026, 9, 26);

describe('graduation year', () => {
  it.each([['2025', true], ['1999', true], ['1234567890', false], ['abcd', false], ['', false], ['20255', false], ['202', false], ['1850', false], ['2099', false], ['20.5', false]])(
    '%s -> valid=%s', (v, valid) => expect(ok(validateGraduationYear(v, NOW))).toBe(valid));
});
describe('email', () => {
  it.each([['harish@example.com', true], ['  Harish@Example.com ', true], ['josé@exämple.org', true], ['1234567890', false], ['abc', false], ['user@', false], ['@example.com', false], ['a@b', false], ['', false], ['   ', false], ['a b@example.com', false], ['two@@example.com', false]])(
    '%s -> valid=%s', (v, valid) => expect(ok(validateEmail(v))).toBe(valid));
});
describe('mobile', () => {
  it.each([['9876543210', true], ['987654321', false], ['98765432101', false], ['abcdefghij', false], ['98765abc10', false], ['0123456789', false], ['1234567890', false], ['+919876543210', false], ['98765 43210', false], ['', false]])(
    '%s -> valid=%s', (v, valid) => expect(ok(validateMobile(v))).toBe(valid));
});
describe('language', () => {
  it.each([['English', true], ['Telugu', true], ['Hindi', true], ['123', false], ['', false], ['French', false]])(
    '%s -> valid=%s', (v, valid) => expect(ok(validateLanguage(v))).toBe(valid));
});
describe('name', () => {
  it.each([['Bhargavi Konda', true], ["O'Brien-Smith", true], ['José Álvarez', true], ['12345', false], ['   ', false], ['A', false], ['<b>x</b>', false], ['John3', false]])(
    '%s -> valid=%s', (v, valid) => expect(ok(validateName(v))).toBe(valid));
});
describe('misc', () => {
  it('password length', () => { expect(validatePassword('short')).not.toBe(''); expect(validatePassword('longenough1')).toBe(''); });
  it('cgpa', () => { expect(validateCgpa('8.5')).toBe(''); expect(validateCgpa('abc')).not.toBe(''); expect(validateCgpa('')).toBe(''); });
  it('dob rejects 5-digit years, future and impossible dates', () => {
    expect(validateDob('2001-05-17', NOW)).toBe('');
    expect(validateDob('20011-05-17', NOW)).not.toBe('');
    expect(validateDob('2030-01-01', NOW)).not.toBe('');
    expect(validateDob('2001-02-31', NOW)).not.toBe('');
    expect(validateDob('2020-01-01', NOW)).not.toBe('');
  });
  it('safeRedirect blocks open redirects and loops', () => {
    expect(safeRedirect('/history')).toBe('/history');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil', '/login', '/onboarding', undefined, 5]) expect(safeRedirect(bad)).toBe('/dashboard');
  });
});
