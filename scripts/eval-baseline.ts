#!/usr/bin/env tsx

/**
 * Baseline evaluation script: Test cosine-only ranking
 * Usage: npm run eval-baseline [--seed=42]
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

interface EvaluationQuestion {
  id: string;
  query: string;
  expectedAnswer: string;
  relevantChunks: string[];
}

interface EvaluationResult {
  questionId: string;
  query: string;
  predictedAnswer: string;
  actualAnswer: string;
  confidence: number;
  accuracy: number;
  correct: boolean;
  brierScore: number;
  topEvidence: any[];
}

interface JSONLResult {
  questionId: string;
  pred: string;
  conf: number;
  correct: boolean;
  brier: number;
}

class BaselineEvaluator {
  private apiUrl = 'http://localhost:8000';
  private resultsDir = path.join(process.cwd(), 'reports');
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed || Math.floor(Math.random() * 10000);
  }

  async run(): Promise<void> {
    console.log('📊 Starting baseline evaluation...');
    console.log(`🎲 Using seed: ${this.seed}`);

    try {
      await this.ensureResultsDir();
      const questions = await this.loadEvaluationQuestions();
      const results = await this.evaluateQuestions(questions);
      const metrics = this.calculateMetrics(results);
      await this.saveResults('baseline', results, metrics);

      console.log('✅ Baseline evaluation completed!');
      console.log(`📈 Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
      console.log(`📉 Brier Score: ${metrics.brierScore.toFixed(3)}`);
      console.log(`🎯 ECE: ${metrics.ece.toFixed(3)}`);
    } catch (error) {
      console.error('❌ Baseline evaluation failed:', error);
      process.exit(1);
    }
  }

  private async ensureResultsDir(): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });
  }

  private async loadEvaluationQuestions(): Promise<EvaluationQuestion[]> {
    try {
      // Load questions from our Q/A dataset
      const datasetPath = path.join(process.cwd(), 'data/evaluation/qa-dataset.json');
      const datasetContent = await fs.readFile(datasetPath, 'utf8');
      const dataset = JSON.parse(datasetContent);

      const questions: EvaluationQuestion[] = dataset.questions.map((q: any) => ({
        id: q.id,
        query: q.question,
        expectedAnswer: q.expectedAnswer,
        relevantChunks: q.citations.map((c: any) => c.sourceFile)
      }));

      console.log(`📝 Loaded ${questions.length} evaluation questions from dataset`);
      return questions;
    } catch (error) {
      console.error('❌ Failed to load Q/A dataset, falling back to sample questions');
      
      // Fallback to sample questions if dataset loading fails
      const questions: EvaluationQuestion[] = [
        {
          id: 'q1',
          query: 'What is climate change?',
          expectedAnswer: 'Climate change refers to long-term shifts in global temperatures and weather patterns caused primarily by human activities since the 1800s.',
          relevantChunks: ['chunk-1']
        }
      ];

      console.log(`📝 Loaded ${questions.length} fallback questions`);
      return questions;
    }
  }

  private async evaluateQuestions(questions: EvaluationQuestion[]): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const question of questions) {
      console.log(`🔍 Evaluating: ${question.query}`);

      try {
        const response = await axios.get(`${this.apiUrl}/api/rank`, {
          params: {
            query: question.query,
            mode: 'baseline',
            k: 3
          }
        });

        const { evidence, answer, confidence } = response.data;
        const accuracy = this.calculateAccuracy(answer, question.expectedAnswer);
        const correct = accuracy >= 0.5; // Consider correct if accuracy >= 50%
        const brierScore = this.calculateBrierScore(confidence, accuracy);

        results.push({
          questionId: question.id,
          query: question.query,
          predictedAnswer: answer,
          actualAnswer: question.expectedAnswer,
          confidence,
          accuracy,
          correct,
          brierScore,
          topEvidence: evidence
        });

        console.log(`  ✓ Accuracy: ${(accuracy * 100).toFixed(1)}%, Confidence: ${(confidence * 100).toFixed(1)}%`);
      } catch (error) {
        console.error(`  ❌ Failed to evaluate question ${question.id}:`, error instanceof Error ? error.message : String(error));
        
        // Add failed result
        results.push({
          questionId: question.id,
          query: question.query,
          predictedAnswer: 'ERROR: Failed to get response',
          actualAnswer: question.expectedAnswer,
          confidence: 0,
          accuracy: 0,
          correct: false,
          brierScore: 1,
          topEvidence: []
        });
      }
    }

    return results;
  }

  private calculateAccuracy(predicted: string, actual: string): number {
    // Simple keyword-based accuracy calculation
    const predictedWords = predicted.toLowerCase().split(/\s+/);
    const actualWords = actual.toLowerCase().split(/\s+/);
    
    const intersection = predictedWords.filter(word => 
      actualWords.some(actualWord => actualWord.includes(word) || word.includes(actualWord))
    );
    
    return intersection.length / Math.max(actualWords.length, 1);
  }

  private calculateBrierScore(confidence: number, accuracy: number): number {
    // Brier score: (confidence - accuracy)^2
    return Math.pow(confidence - accuracy, 2);
  }

  private calculateMetrics(results: EvaluationResult[]) {
    const totalQuestions = results.length;
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / totalQuestions;
    const avgBrierScore = results.reduce((sum, r) => sum + r.brierScore, 0) / totalQuestions;
    
    // Calculate Expected Calibration Error (ECE)
    const ece = this.calculateECE(results);

    return {
      totalQuestions,
      accuracy: avgAccuracy,
      brierScore: avgBrierScore,
      ece,
      timestamp: new Date().toISOString()
    };
  }

  private calculateECE(results: EvaluationResult[]): number {
    // Simplified ECE calculation with 10 bins
    const bins = 10;
    const binSize = 1.0 / bins;
    let ece = 0;

    for (let i = 0; i < bins; i++) {
      const binLower = i * binSize;
      const binUpper = (i + 1) * binSize;
      
      const binResults = results.filter(r => 
        r.confidence >= binLower && r.confidence < binUpper
      );

      if (binResults.length > 0) {
        const avgConfidence = binResults.reduce((sum, r) => sum + r.confidence, 0) / binResults.length;
        const avgAccuracy = binResults.reduce((sum, r) => sum + r.accuracy, 0) / binResults.length;
        const binWeight = binResults.length / results.length;
        
        ece += binWeight * Math.abs(avgConfidence - avgAccuracy);
      }
    }

    return ece;
  }

  private async saveResults(mode: string, results: EvaluationResult[], metrics: any): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report (existing format)
    const jsonFilename = `${mode}-evaluation-${timestamp}.json`;
    const jsonFilepath = path.join(this.resultsDir, jsonFilename);
    const report = {
      mode,
      metrics,
      results,
      seed: this.seed,
      generatedAt: new Date().toISOString()
    };
    await fs.writeFile(jsonFilepath, JSON.stringify(report, null, 2));
    console.log(`💾 JSON results saved to: ${jsonFilename}`);

    // Save JSONL format (Issue #5 requirement)
    const jsonlFilename = `${mode}-evaluation-${timestamp}.jsonl`;
    const jsonlFilepath = path.join(this.resultsDir, jsonlFilename);
    const jsonlResults: JSONLResult[] = results.map(r => ({
      questionId: r.questionId,
      pred: r.predictedAnswer,
      conf: r.confidence,
      correct: r.correct,
      brier: r.brierScore
    }));
    const jsonlContent = jsonlResults.map(r => JSON.stringify(r)).join('\n');
    await fs.writeFile(jsonlFilepath, jsonlContent);
    console.log(`💾 JSONL results saved to: ${jsonlFilename}`);

    // Save summary table (Issue #5 requirement)
    const summaryFilename = `${mode}-summary-${timestamp}.md`;
    const summaryFilepath = path.join(this.resultsDir, summaryFilename);
    const summaryContent = this.generateSummaryTable(results, metrics);
    await fs.writeFile(summaryFilepath, summaryContent);
    console.log(`💾 Summary table saved to: ${summaryFilename}`);
  }

  private generateSummaryTable(results: EvaluationResult[], metrics: any): string {
    const correctCount = results.filter(r => r.correct).length;
    const totalCount = results.length;
    
    const lines = [
      '# Baseline Evaluation Summary',
      `Generated: ${new Date().toISOString()}`,
      `Seed: ${this.seed}`,
      '',
      '## Overall Metrics',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Total Questions | ${totalCount} |`,
      `| Correct Answers | ${correctCount} |`,
      `| Accuracy | ${(metrics.accuracy * 100).toFixed(1)}% |`,
      `| Brier Score | ${metrics.brierScore.toFixed(3)} |`,
      `| ECE | ${metrics.ece.toFixed(3)} |`,
      '',
      '## Per-Question Results',
      '',
      '| Question ID | Correct | Confidence | Brier Score |',
      '|-------------|---------|------------|-------------|',
      ...results.map(r => 
        `| ${r.questionId} | ${r.correct ? '✅' : '❌'} | ${(r.confidence * 100).toFixed(1)}% | ${r.brierScore.toFixed(3)} |`
      ),
      '',
      '## Question Details',
      '',
      ...results.flatMap(r => [
        `### ${r.questionId}`,
        `**Query:** ${r.query}`,
        `**Predicted:** ${r.predictedAnswer}`,
        `**Accuracy:** ${(r.accuracy * 100).toFixed(1)}%`,
        `**Confidence:** ${(r.confidence * 100).toFixed(1)}%`,
        `**Correct:** ${r.correct ? 'Yes' : 'No'}`,
        `**Brier Score:** ${r.brierScore.toFixed(3)}`,
        ''
      ])
    ];

    return lines.join('\n');
  }
}

// Parse command line arguments
function parseArgs(): { seed?: number } {
  const args = process.argv.slice(2);
  const result: { seed?: number } = {};
  
  for (const arg of args) {
    if (arg.startsWith('--seed=')) {
      const seedValue = parseInt(arg.split('=')[1], 10);
      if (!isNaN(seedValue)) {
        result.seed = seedValue;
      }
    }
  }
  
  return result;
}

// Run the baseline evaluation
async function main() {
  const { seed } = parseArgs();
  const evaluator = new BaselineEvaluator(seed);
  await evaluator.run();
}

main().catch(console.error);
