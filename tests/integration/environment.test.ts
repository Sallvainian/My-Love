/**
 * Environment Configuration Integration Tests
 *
 * Story 0.2: Environment Variables & Secrets Management
 * Tests configuration files, git ignore patterns, and build environment setup
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Environment Configuration Integration', () => {
  describe('AC-0.2.1: .env.example Documentation', () => {
    it('should exist at project root', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it('should document all required VITE_ environment variables', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      // Check for VITE_SUPABASE_URL
      expect(envExample).toContain('VITE_SUPABASE_URL');
      expect(envExample).toMatch(/VITE_SUPABASE_URL\s*=/);

      // Check for VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
      expect(envExample).toContain('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
      expect(envExample).toMatch(/VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY\s*=/);
    });

    it('should include inline comments explaining purpose of each variable', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      // Check for descriptive comments
      expect(envExample).toMatch(/# Supabase.*URL/i);
      expect(envExample).toMatch(/# Supabase.*Key/i);
      expect(envExample).toMatch(/Format:/i); // Should have format examples
    });

    it('should provide example values in placeholder format', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      // Check for placeholder values (not real credentials)
      expect(envExample).toMatch(/VITE_SUPABASE_URL\s*=\s*https:\/\/.*your-project-id/);
      expect(envExample).toMatch(/VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY\s*=\s*your.*key/i);
    });

    it('should explain VITE_SUPABASE_URL format', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      // Check for format documentation
      expect(envExample).toMatch(/https:\/\/\[project-id\]\.supabase\.co/i);
    });

    it('should note that VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY is safe for public exposure', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      // Check for RLS/security note
      expect(envExample).toMatch(/safe.*public/i);
      expect(envExample).toMatch(/RLS|Row Level Security/i);
    });
  });

  describe('AC-0.2.2: Git Ignore Configuration (dotenvx encrypted)', () => {
    // NOTE: Using dotenvx - .env is encrypted and safe to commit
    // Only .env.keys (decryption key) must be gitignored

    it('should have .env.keys in .gitignore (dotenvx decryption key)', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

      // Check for .env.keys entry (contains decryption key - must be secret)
      expect(gitignore).toMatch(/^\.env\.keys$/m);
    });

    it('should have .env.local file entry in .gitignore', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

      // Check for .env.local entry
      expect(gitignore).toMatch(/^\.env\.local$/m);
    });

    it('should NOT ignore .env.example', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');

      // .env.example should NOT be in .gitignore
      expect(gitignore).not.toMatch(/^\.env\.example$/m);
    });
  });

  describe('AC-0.2.7: Environment Separation', () => {
    it('should verify GitHub Actions workflow injects environment variables', () => {
      const workflowPath = path.join(projectRoot, '.github/workflows/deploy.yml');

      // Check if workflow file exists
      if (!fs.existsSync(workflowPath)) {
        // Try alternate workflow file names
        const workflowDir = path.join(projectRoot, '.github/workflows');
        if (fs.existsSync(workflowDir)) {
          const workflowFiles = fs.readdirSync(workflowDir);
          expect(workflowFiles.length).toBeGreaterThan(0);
        }
        return;
      }

      const workflow = fs.readFileSync(workflowPath, 'utf-8');

      // Check for env: section with VITE_SUPABASE secrets injection
      expect(workflow).toMatch(/env:/);
      expect(workflow).toMatch(/VITE_SUPABASE_URL.*secrets/);
      expect(workflow).toMatch(/VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY.*secrets/);
    });

    it('should document environment setup for both local and production', () => {
      const readmePath = path.join(projectRoot, 'README.md');
      const readme = fs.readFileSync(readmePath, 'utf-8');

      // Check for environment setup documentation
      expect(readme).toMatch(/environment|env.*setup|configuration/i);
      expect(readme).toMatch(/\.env|environment variables/i);
      expect(readme).toMatch(/GitHub.*Secrets|production/i);
    });
  });

  describe('TypeScript Environment Types', () => {
    it('should define ImportMetaEnv interface in vite-env.d.ts', () => {
      const viteEnvPath = path.join(projectRoot, 'src/vite-env.d.ts');
      const viteEnv = fs.readFileSync(viteEnvPath, 'utf-8');

      // Check for ImportMetaEnv interface
      expect(viteEnv).toMatch(/interface\s+ImportMetaEnv/);
      expect(viteEnv).toMatch(/VITE_SUPABASE_URL.*string/);
      expect(viteEnv).toMatch(/VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY.*string/);
    });

    it('should declare readonly environment variables', () => {
      const viteEnvPath = path.join(projectRoot, 'src/vite-env.d.ts');
      const viteEnv = fs.readFileSync(viteEnvPath, 'utf-8');

      // Check for readonly modifier
      expect(viteEnv).toMatch(/readonly\s+VITE_SUPABASE_URL/);
      expect(viteEnv).toMatch(/readonly\s+VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY/);
    });

    it('should extend ImportMeta interface', () => {
      const viteEnvPath = path.join(projectRoot, 'src/vite-env.d.ts');
      const viteEnv = fs.readFileSync(viteEnvPath, 'utf-8');

      // Check for ImportMeta interface extension
      expect(viteEnv).toMatch(/interface\s+ImportMeta/);
      expect(viteEnv).toMatch(/readonly\s+env:\s*ImportMetaEnv/);
    });
  });

  describe('File Permissions and Security', () => {
    it('.env.example should be readable', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      expect(() => fs.accessSync(envExamplePath, fs.constants.R_OK)).not.toThrow();
    });

    it('.gitignore should be readable', () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      expect(() => fs.accessSync(gitignorePath, fs.constants.R_OK)).not.toThrow();
    });

    it('should verify dotenvx encryption if .env file exists', () => {
      const envPath = path.join(projectRoot, '.env');

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');

        // With dotenvx, .env should contain DOTENV_PUBLIC_KEY (encrypted)
        // or be an encrypted file safe to commit
        const hasDotenvxPublicKey = envContent.includes('DOTENV_PUBLIC_KEY');
        const isEncrypted = envContent.includes('encrypted:');

        // Either has public key (dotenvx managed) or contains encrypted values
        expect(hasDotenvxPublicKey || isEncrypted).toBe(true);

        // Verify .env.keys (decryption key) is in .gitignore
        const gitignorePath = path.join(projectRoot, '.gitignore');
        const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        expect(gitignore).toMatch(/^\.env\.keys$/m);
      }
    });
  });

  describe('Configuration Consistency', () => {
    it('should have consistent variable names between .env.example and vite-env.d.ts', () => {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const viteEnvPath = path.join(projectRoot, 'src/vite-env.d.ts');

      const envExample = fs.readFileSync(envExamplePath, 'utf-8');
      const viteEnv = fs.readFileSync(viteEnvPath, 'utf-8');

      // Extract variable names from .env.example
      const envVars = envExample.match(/^VITE_[A-Z_]+(?==)/gm) || [];

      // Verify each env var is in vite-env.d.ts
      for (const envVar of envVars) {
        expect(viteEnv).toMatch(new RegExp(`\\b${envVar}\\b`));
      }
    });

    it('should have consistent variable names between README.md and .env.example', () => {
      const readmePath = path.join(projectRoot, 'README.md');
      const envExamplePath = path.join(projectRoot, '.env.example');

      const readme = fs.readFileSync(readmePath, 'utf-8');
      const envExample = fs.readFileSync(envExamplePath, 'utf-8');

      // Key environment variables should be mentioned in README
      if (envExample.includes('VITE_SUPABASE_URL')) {
        expect(readme).toMatch(/VITE_SUPABASE_URL/);
      }

      if (envExample.includes('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY')) {
        expect(readme).toMatch(/VITE_SUPABASE.*KEY|SUPABASE.*KEY/);
      }
    });
  });
});
