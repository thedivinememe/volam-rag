#!/usr/bin/env tsx

/**
 * Baseline evaluation script: Test cosine-only ranking
 * Usage: npm run eval-baseline
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
  brierScore: number;
  topEvidence: any[];
}

class BaselineEvaluator {
  private apiUrl = 'http://localhost:8000';
  private resultsDir = path.join(process.cwd(), 'reports');

  async run(): Promise<void> {
    console.log('📊 Starting baseline evaluation...');

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
    // Create sample evaluation questions
    const questions: EvaluationQuestion[] = [
      {
        id: 'q1',
        query: 'What is climate change?',
        expectedAnswer: 'Climate change refers to long-term shifts in global temperatures and weather patterns caused primarily by human activities since the 1800s.',
        relevantChunks: ['chunk-1']
      },
      {
        id: 'q2',
        query: 'How does artificial intelligence work?',
        expectedAnswer: 'AI works by using machine learning algorithms that enable computers to learn and improve from experience without being explicitly programmed.',
        relevantChunks: ['chunk-2']
      },
      {
        id: 'q3',
        query: 'What are renewable energy sources?',
        expectedAnswer: 'Renewable energy sources include solar, wind, hydroelectric, and geothermal energy that come from natural sources that are constantly replenished.',
        relevantChunks: ['chunk-3']
      },
      {
        id: 'q4',
        query: 'What causes greenhouse gas emissions?',
        expectedAnswer: 'Greenhouse gas emissions are primarily caused by burning fossil fuels, which generates emissions that trap heat in the atmosphere.',
        relevantChunks: ['chunk-1']
      },
      {
        id: 'q5',
        query: 'What is machine learning?',
        expectedAnswer: 'Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.',
        relevantChunks: ['chunk-2']
      }
    ];

    console.log(`📝 Loaded ${questions.length} evaluation questions`);
    return questions;
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
        const brierScore = this.calculateBrierScore(confidence, accuracy);

        results.push({
          questionId: question.id,
          query: question.query,
          predictedAnswer: answer,
          actualAnswer: question.expectedAnswer,
          confidence,
          accuracy,
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
    const filename = `${mode}-evaluation-${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);

    const report = {
      mode,
      metrics,
      results,
      generatedAt: new Date().toISOString()
    };

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`💾 Results saved to: ${filename}`);
  }
}

// Run the baseline evaluation
const evaluator = new BaselineEvaluator();
evaluator.run();
