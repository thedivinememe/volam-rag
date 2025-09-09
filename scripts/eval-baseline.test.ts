#!/usr/bin/env tsx

/**
 * Test suite for baseline evaluation script
 */

import { afterAll, describe, expect, it } from 'vitest';

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

describe('Baseline Evaluation CLI', () => {
  const reportsDir = path.join(process.cwd(), 'reports');
  const testFiles: string[] = [];

  afterAll(async () => {
    // Clean up test files
    for (const file of testFiles) {
      try {
        await fs.unlink(path.join(reportsDir, file));
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should run baseline evaluation and produce required outputs', async () => {
    // Run the baseline evaluation with a fixed seed for reproducibility
    const result = await runEvaluation(['--seed=123']);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('📊 Starting baseline evaluation...');
    expect(result.stdout).toContain('🎲 Using seed: 123');
    expect(result.stdout).toContain('✅ Baseline evaluation completed!');
    
    // Check that required output files were created
    const files = await fs.readdir(reportsDir);
    const timestampPattern = /2025-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/;
    
    const jsonFile = files.find(f => f.startsWith('baseline-evaluation-') && f.endsWith('.json') && timestampPattern.test(f));
    const jsonlFile = files.find(f => f.startsWith('baseline-evaluation-') && f.endsWith('.jsonl') && timestampPattern.test(f));
    const summaryFile = files.find(f => f.startsWith('baseline-summary-') && f.endsWith('.md') && timestampPattern.test(f));
    
    expect(jsonFile).toBeDefined();
    expect(jsonlFile).toBeDefined();
    expect(summaryFile).toBeDefined();
    
    if (jsonFile) testFiles.push(jsonFile);
    if (jsonlFile) testFiles.push(jsonlFile);
    if (summaryFile) testFiles.push(summaryFile);
  }, 60000); // 60 second timeout for evaluation

  it('should produce valid JSONL format', async () => {
    const result = await runEvaluation(['--seed=456']);
    expect(result.exitCode).toBe(0);
    
    const files = await fs.readdir(reportsDir);
    const jsonlFile = files.find(f => f.startsWith('baseline-evaluation-') && f.endsWith('.jsonl'));
    
    if (jsonlFile) {
      testFiles.push(jsonlFile);
      const content = await fs.readFile(path.join(reportsDir, jsonlFile), 'utf8');
      const lines = content.trim().split('\n');
      
      // Each line should be valid JSON
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('questionId');
        expect(parsed).toHaveProperty('pred');
        expect(parsed).toHaveProperty('conf');
        expect(parsed).toHaveProperty('correct');
        expect(parsed).toHaveProperty('brier');
      }
    }
  }, 60000);

  it('should produce valid summary format', async () => {
    const result = await runEvaluation(['--seed=789']);
    expect(result.exitCode).toBe(0);
    
    const files = await fs.readdir(reportsDir);
    const summaryFile = files.find(f => f.startsWith('baseline-summary-') && f.endsWith('.md'));
    
    if (summaryFile) {
      testFiles.push(summaryFile);
      const content = await fs.readFile(path.join(reportsDir, summaryFile), 'utf8');
      
      expect(content).toContain('# Baseline Evaluation Summary');
      expect(content).toContain('## Overall Metrics');
      expect(content).toContain('| Metric | Value |');
      expect(content).toContain('| Total Questions |');
      expect(content).toContain('| Accuracy |');
      expect(content).toContain('| Brier Score |');
      expect(content).toContain('| ECE |');
    }
  }, 60000);

  it('should be reproducible with same seed', async () => {
    const seed = '999';
    const result1 = await runEvaluation([`--seed=${seed}`]);
    const result2 = await runEvaluation([`--seed=${seed}`]);
    
    expect(result1.exitCode).toBe(0);
    expect(result2.exitCode).toBe(0);
    
    // Both should use the same seed
    expect(result1.stdout).toContain(`🎲 Using seed: ${seed}`);
    expect(result2.stdout).toContain(`🎲 Using seed: ${seed}`);
    
    // Extract accuracy from both runs
    const accuracy1 = extractAccuracy(result1.stdout);
    const accuracy2 = extractAccuracy(result2.stdout);
    
    expect(accuracy1).toBe(accuracy2);
  }, 120000);

  async function runEvaluation(args: string[] = []): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('tsx', ['scripts/eval-baseline.ts', ...args], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  function extractAccuracy(output: string): string | null {
    const match = output.match(/📈 Accuracy: ([\d.]+)%/);
    return match ? match[1] : null;
  }
});
