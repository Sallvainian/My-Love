import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import {
  formatZodError,
  getFieldErrors,
  createValidationError,
  ValidationError,
  isValidationError,
  isZodError,
} from '../../../src/validation/errorMessages';

describe('Error Message Utilities', () => {
  describe('formatZodError', () => {
    it('should format single field error', () => {
      const schema = z.object({
        text: z.string().min(1),
      });

      try {
        schema.parse({ text: '' });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatZodError(error);
          expect(message).toContain('Message cannot be empty');
        }
      }
    });

    it('should format multiple field errors', () => {
      const schema = z.object({
        text: z.string().min(1),
        category: z.enum(['reason', 'memory']),
      });

      try {
        schema.parse({ text: '', category: 'invalid' });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatZodError(error);
          expect(message).toBeTruthy();
          expect(typeof message).toBe('string');
        }
      }
    });

    it('should handle too_small error for strings', () => {
      const schema = z.object({
        text: z.string().min(5),
      });

      try {
        schema.parse({ text: 'ab' });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatZodError(error);
          expect(message).toContain('5 characters');
        }
      }
    });

    it('should handle too_big error for strings', () => {
      const schema = z.object({
        caption: z.string().max(500),
      });

      try {
        schema.parse({ caption: 'a'.repeat(501) });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatZodError(error);
          expect(message).toContain('500 characters');
        }
      }
    });

    it('should handle invalid enum errors', () => {
      const schema = z.object({
        mood: z.enum(['loved', 'happy']),
      });

      try {
        schema.parse({ mood: 'invalid' });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatZodError(error);
          expect(message).toContain('valid option');
        }
      }
    });

    it('should handle nested field paths', () => {
      const schema = z.object({
        relationship: z.object({
          partnerName: z.string().min(1),
        }),
      });

      try {
        schema.parse({ relationship: { partnerName: '' } });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatZodError(error);
          // Should reference partner name in some way
          expect(message).toBeTruthy();
        }
      }
    });
  });

  describe('getFieldErrors', () => {
    it('should return map of field errors', () => {
      const schema = z.object({
        text: z.string().min(1),
        category: z.enum(['reason', 'memory']),
      });

      try {
        schema.parse({ text: '', category: 'invalid' });
      } catch (error) {
        if (error instanceof ZodError) {
          const fieldErrors = getFieldErrors(error);
          expect(fieldErrors).toBeInstanceOf(Map);
          expect(fieldErrors.size).toBeGreaterThan(0);
        }
      }
    });

    it('should map field paths to error messages', () => {
      const schema = z.object({
        text: z.string().min(1, 'Text is required'),
      });

      try {
        schema.parse({ text: '' });
      } catch (error) {
        if (error instanceof ZodError) {
          const fieldErrors = getFieldErrors(error);
          expect(fieldErrors.has('text')).toBe(true);
          const errorMsg = fieldErrors.get('text');
          expect(errorMsg).toBeTruthy();
        }
      }
    });

    it('should only store first error for each field', () => {
      const schema = z.object({
        text: z.string().min(1).max(10),
      });

      try {
        // This might trigger multiple errors
        schema.parse({ text: '' });
      } catch (error) {
        if (error instanceof ZodError) {
          const fieldErrors = getFieldErrors(error);
          // Should have at most one error per field
          expect(fieldErrors.has('text')).toBe(true);
        }
      }
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with message', () => {
      const error = new ValidationError('Validation failed');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
    });

    it('should create ValidationError with field errors map', () => {
      const fieldErrors = new Map([
        ['text', 'Text cannot be empty'],
        ['category', 'Invalid category'],
      ]);
      const error = new ValidationError('Validation failed', fieldErrors);

      expect(error.fieldErrors).toBe(fieldErrors);
      expect(error.fieldErrors.size).toBe(2);
    });

    it('should create ValidationError with empty field errors map by default', () => {
      const error = new ValidationError('Validation failed');
      expect(error.fieldErrors).toBeInstanceOf(Map);
      expect(error.fieldErrors.size).toBe(0);
    });
  });

  describe('createValidationError', () => {
    it('should convert ZodError to ValidationError', () => {
      const schema = z.object({
        text: z.string().min(1),
      });

      try {
        schema.parse({ text: '' });
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = createValidationError(error);
          expect(validationError).toBeInstanceOf(ValidationError);
          expect(validationError.message).toBeTruthy();
          expect(validationError.fieldErrors).toBeInstanceOf(Map);
        }
      }
    });

    it('should preserve field error details in ValidationError', () => {
      const schema = z.object({
        text: z.string().min(1),
        category: z.enum(['reason', 'memory']),
      });

      try {
        schema.parse({ text: '', category: 'invalid' });
      } catch (error) {
        if (error instanceof ZodError) {
          const validationError = createValidationError(error);
          expect(validationError.fieldErrors.size).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('isValidationError', () => {
    it('should return true for ValidationError instances', () => {
      const error = new ValidationError('Test error');
      expect(isValidationError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test error');
      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for ZodError instances', () => {
      const schema = z.object({ text: z.string().min(1) });

      try {
        schema.parse({ text: '' });
      } catch (error) {
        expect(isValidationError(error)).toBe(false);
      }
    });

    it('should return false for non-error values', () => {
      expect(isValidationError('string')).toBe(false);
      expect(isValidationError(123)).toBe(false);
      expect(isValidationError(null)).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
    });
  });

  describe('isZodError', () => {
    it('should return true for ZodError instances', () => {
      const schema = z.object({ text: z.string().min(1) });

      try {
        schema.parse({ text: '' });
      } catch (error) {
        expect(isZodError(error)).toBe(true);
      }
    });

    it('should return false for ValidationError instances', () => {
      const error = new ValidationError('Test error');
      expect(isZodError(error)).toBe(false);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Test error');
      expect(isZodError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isZodError('string')).toBe(false);
      expect(isZodError(123)).toBe(false);
      expect(isZodError(null)).toBe(false);
      expect(isZodError(undefined)).toBe(false);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete validation workflow', () => {
      const schema = z.object({
        text: z.string().min(1, 'Text is required'),
        category: z.enum(['reason', 'memory']),
      });

      try {
        schema.parse({ text: '', category: 'invalid' });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        // Check it's a ZodError
        expect(isZodError(error)).toBe(true);
        expect(isValidationError(error)).toBe(false);

        if (isZodError(error)) {
          // Format the error
          const message = formatZodError(error);
          expect(message).toBeTruthy();

          // Get field errors
          const fieldErrors = getFieldErrors(error);
          expect(fieldErrors.size).toBeGreaterThan(0);

          // Create ValidationError
          const validationError = createValidationError(error);
          expect(isValidationError(validationError)).toBe(true);
          expect(isZodError(validationError)).toBe(false);
          expect(validationError.message).toBeTruthy();
          expect(validationError.fieldErrors.size).toBeGreaterThan(0);
        }
      }
    });
  });
});
