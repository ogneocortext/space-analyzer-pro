import { describe, it, expect } from 'vitest';
import { 
  validatePath, 
  sanitizeString, 
  validateNumericInput,
  validateStringInput,
  validateEmail,
  validateUrl
} from './InputValidation';

describe('InputValidation', () => {
  describe('validatePath', () => {
    it('accepts valid file paths', () => {
      const validPaths = [
        'C:\\Users\\test\\documents',
        '/home/user/documents',
        'D:\\Projects\\my-app',
        './relative/path'
      ];

      validPaths.forEach(path => {
        expect(validatePath(path)).toBe(true);
      });
    });

    it('rejects paths with null bytes', () => {
      const invalidPaths = [
        'path\0with\0null',
        'C:\\Users\\test\0malicious'
      ];

      invalidPaths.forEach(path => {
        expect(validatePath(path)).toBe(false);
      });
    });

    it('rejects paths with directory traversal', () => {
      const invalidPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'folder/../../../secret'
      ];

      invalidPaths.forEach(path => {
        expect(validatePath(path)).toBe(false);
      });
    });

    it('rejects paths that are too long', () => {
      const longPath = 'a'.repeat(5000);
      expect(validatePath(longPath)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('removes HTML tags', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('removes JavaScript protocol', () => {
      const input = 'javascript:alert("xss")';
      const result = sanitizeString(input);
      expect(result).not.toContain('javascript:');
    });

    it('removes event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Click me</div>';
      const result = sanitizeString(input);
      expect(result).not.toContain('onclick');
    });

    it('preserves safe content', () => {
      const input = 'This is safe content with numbers 123 and symbols !@#$%';
      const result = sanitizeString(input);
      expect(result).toBe(input);
    });
  });

  describe('validateNumericInput', () => {
    it('accepts valid numbers', () => {
      expect(validateNumericInput(123)).toBe(true);
      expect(validateNumericInput(0)).toBe(true);
      expect(validateNumericInput(-100)).toBe(true);
    });

    it('accepts numbers within range', () => {
      expect(validateNumericInput(50, { min: 0, max: 100 })).toBe(true);
      expect(validateNumericInput(25, { min: 10, max: 50 })).toBe(true);
    });

    it('rejects numbers outside range', () => {
      expect(validateNumericInput(-1, { min: 0 })).toBe(false);
      expect(validateNumericInput(101, { max: 100 })).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(validateNumericInput('not a number')).toBe(false);
      expect(validateNumericInput(null)).toBe(false);
      expect(validateNumericInput(undefined)).toBe(false);
    });
  });

  describe('validateStringInput', () => {
    it('accepts valid strings', () => {
      expect(validateStringInput('valid string')).toBe(true);
      expect(validateStringInput('')).toBe(true);
    });

    it('validates string length', () => {
      expect(validateStringInput('a'.repeat(10), { minLength: 5, maxLength: 20 })).toBe(true);
      expect(validateStringInput('a'.repeat(4), { minLength: 5, maxLength: 20 })).toBe(false);
      expect(validateStringInput('a'.repeat(25), { minLength: 5, maxLength: 20 })).toBe(false);
    });

    it('validates string patterns', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(validateStringInput('test@example.com', { pattern: emailPattern })).toBe(true);
      expect(validateStringInput('invalid-email', { pattern: emailPattern })).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(validateStringInput(123)).toBe(false);
      expect(validateStringInput(null)).toBe(false);
      expect(validateStringInput(undefined)).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name+tag@domain.co.uk',
        'user123@test-domain.org'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('rejects invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain..com'
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validateUrl', () => {
    it('accepts valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'ftp://files.example.org'
      ];

      validUrls.forEach(url => {
        expect(validateUrl(url)).toBe(true);
      });
    });

    it('rejects invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      invalidUrls.forEach(url => {
        expect(validateUrl(url)).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty and null inputs gracefully', () => {
      expect(validatePath('')).toBe(false);
      expect(validatePath(null)).toBe(false);
      expect(validatePath(undefined)).toBe(false);
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    it('handles unicode characters', () => {
      const unicodeString = 'Hello 世界 🌍';
      const sanitized = sanitizeString(unicodeString);
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('世界');
      expect(sanitized).toContain('🌍');
    });
  });
});
