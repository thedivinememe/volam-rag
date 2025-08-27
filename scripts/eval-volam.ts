#!/usr/bin/env tsx

/**
 * VOLaM evaluation script: Test VOLaM ranking algorithm
 * Usage: npm run eval-volam
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
  volamScore?: number;
  nullness?: number;
  empathyFit?: number;
}

class VOLaMEvaluator {
  private apiUrl = 'http://localhost:8000';
  private resultsDir = path.join(process.cwd(), 'reports');

  async run(): Promise<void> {
    console.log('🚀 Starting VOLaM evaluation...');

    try {
      await this.ensureResultsDir();
      const questions = await this.loadEvaluationQuestions();
      const results = await this.evaluateQuestions(questions);
      const metrics = this.calculateMetrics(results);
      await this.saveResults('volam', results, metrics);
      await this.generateComparisonReport();

      console.log('✅ VOLaM evaluation completed!');
      console.log(`📈 Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
      console.log(`📉 Brier Score: ${metrics.brierScore.toFixed(3)}`);
      console.log(`🎯 ECE: ${metrics.ece.toFixed(3)}`);
    } catch (error) {
      console.error('❌ VOLaM evaluation failed:', error);
      process.exit(1);
    }
  }

  private async ensureResultsDir(): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });
  }

  private async loadEvaluationQuestions(): Promise<EvaluationQuestion[]> {
    // Same questions as baseline for comparison
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
            mode: 'volam',
            k: 3,
            alpha: 0.6,
            beta: 0.3,
            gamma: 0.1
          }
        });

        const { evidence, answer, confidence, nullness } = response.data;
        const accuracy = this.calculateAccuracy(answer, question.expectedAnswer);
        const brierScore = this.calculateBrierScore(confidence, accuracy);

        // Extract VOLaM-specific metrics
        const topEvidence = evidence[0] || {};
        const volamScore = topEvidence.score || 0;
        const empathyFit = topEvidence.empathyFit || 0;

        results.push({
          questionId: question.id,
          query: question.query,
          predictedAnswer: answer,
          actualAnswer: question.expectedAnswer,
          confidence,
          accuracy,
          brierScore,
          topEvidence: evidence,
          volamScore,
          nullness,
          empathyFit
        });

        console.log(`  ✓ Accuracy: ${(accuracy * 100).toFixed(1)}%, Confidence: ${(confidence * 100).toFixed(1)}%, VOLaM: ${volamScore.toFixed(3)}`);
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
          topEvidence: [],
          volamScore: 0,
          nullness: 1,
          empathyFit: 0
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
    const avgVOLaMScore = results.reduce((sum, r) => sum + (r.volamScore || 0), 0) / totalQuestions;
    const avgNullness = results.reduce((sum, r) => sum + (r.nullness || 0), 0) / totalQuestions;
    const avgEmpathyFit = results.reduce((sum, r) => sum + (r.empathyFit || 0), 0) / totalQuestions;
    
    // Calculate Expected Calibration Error (ECE)
    const ece = this.calculateECE(results);

    return {
      totalQuestions,
      accuracy: avgAccuracy,
      brierScore: avgBrierScore,
      ece,
      volamScore: avgVOLaMScore,
      nullness: avgNullness,
      empathyFit: avgEmpathyFit,
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

  private async generateComparisonReport(): Promise<void> {
    try {
      // Find the latest baseline and volam reports
      const files = await fs.readdir(this.resultsDir);
      const baselineFiles = files.filter(f => f.startsWith('baseline-evaluation-')).sort().reverse();
      const volamFiles = files.filter(f => f.startsWith('volam-evaluation-')).sort().reverse();

      if (baselineFiles.length === 0 || volamFiles.length === 0) {
        console.log('⚠️  Cannot generate comparison report: missing baseline or VOLaM results');
        return;
      }

      const baselineReport = JSON.parse(await fs.readFile(path.join(this.resultsDir, baselineFiles[0]), 'utf-8'));
      const volamReport = JSON.parse(await fs.readFile(path.join(this.resultsDir, volamFiles[0]), 'utf-8'));

      const comparison = {
        generatedAt: new Date().toISOString(),
        baseline: {
          accuracy: baselineReport.metrics.accuracy,
          brierScore: baselineReport.metrics.brierScore,
          ece: baselineReport.metrics.ece
        },
        volam: {
          accuracy: volamReport.metrics.accuracy,
          brierScore: volamReport.metrics.brierScore,
          ece: volamReport.metrics.ece,
          volamScore: volamReport.metrics.volamScore,
          nullness: volamReport.metrics.nullness,
          empathyFit: volamReport.metrics.empathyFit
        },
        improvements: {
          accuracyDelta: volamReport.metrics.accuracy - baselineReport.metrics.accuracy,
          brierScoreDelta: volamReport.metrics.brierScore - baselineReport.metrics.brierScore,
          eceDelta: volamReport.metrics.ece - baselineReport.metrics.ece,
          accuracyImprovement: ((volamReport.metrics.accuracy - baselineReport.metrics.accuracy) / baselineReport.metrics.accuracy * 100),
          brierScoreImprovement: ((baselineReport.metrics.brierScore - volamReport.metrics.brierScore) / baselineReport.metrics.brierScore * 100),
          eceImprovement: ((baselineReport.metrics.ece - volamReport.metrics.ece) / baselineReport.metrics.ece * 100)
        },
        summary: {
          meetsAccuracyTarget: (volamReport.metrics.accuracy - baselineReport.metrics.accuracy) >= 0.10,
          meetsBrierTarget: ((baselineReport.metrics.brierScore - volamReport.metrics.brierScore) / baselineReport.metrics.brierScore) >= 0.15,
          meetsECETarget: ((baselineReport.metrics.ece - volamReport.metrics.ece) / baselineReport.metrics.ece) >= 0.15
        }
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const comparisonFile = `comparison-report-${timestamp}.json`;
      await fs.writeFile(path.join(this.resultsDir, comparisonFile), JSON.stringify(comparison, null, 2));

      // Generate human-readable summary
      const summaryLines = [
        '# VOLaM-RAG Evaluation Comparison Report',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Results Summary',
        '',
        '### Baseline (Cosine-only)',
        `- Accuracy: ${(comparison.baseline.accuracy * 100).toFixed(1)}%`,
        `- Brier Score: ${comparison.baseline.brierScore.toFixed(3)}`,
        `- ECE: ${comparison.baseline.ece.toFixed(3)}`,
        '',
        '### VOLaM Algorithm',
        `- Accuracy: ${(comparison.volam.accuracy * 100).toFixed(1)}%`,
        `- Brier Score: ${comparison.volam.brierScore.toFixed(3)}`,
        `- ECE: ${comparison.volam.ece.toFixed(3)}`,
        `- Average VOLaM Score: ${comparison.volam.volamScore.toFixed(3)}`,
        `- Average Nullness: ${comparison.volam.nullness.toFixed(3)}`,
        `- Average Empathy Fit: ${comparison.volam.empathyFit.toFixed(3)}`,
        '',
        '## Performance Improvements',
        '',
        `**Accuracy**: ${comparison.improvements.accuracyDelta >= 0 ? '+' : ''}${(comparison.improvements.accuracyDelta * 100).toFixed(1)}% (${comparison.improvements.accuracyImprovement >= 0 ? '+' : ''}${comparison.improvements.accuracyImprovement.toFixed(1)}% relative)`,
        `**Brier Score**: ${comparison.improvements.brierScoreDelta <= 0 ? '' : '+'}${comparison.improvements.brierScoreDelta.toFixed(3)} (${comparison.improvements.brierScoreImprovement >= 0 ? '+' : ''}${comparison.improvements.brierScoreImprovement.toFixed(1)}% improvement)`,
        `**ECE**: ${comparison.improvements.eceDelta <= 0 ? '' : '+'}${comparison.improvements.eceDelta.toFixed(3)} (${comparison.improvements.eceImprovement >= 0 ? '+' : ''}${comparison.improvements.eceImprovement.toFixed(1)}% improvement)`,
        '',
        '## Target Achievement',
        '',
        `- ✅ +10% absolute accuracy improvement: ${comparison.summary.meetsAccuracyTarget ? 'ACHIEVED' : 'NOT MET'}`,
        `- ✅ ≥15% Brier score reduction: ${comparison.summary.meetsBrierTarget ? 'ACHIEVED' : 'NOT MET'}`,
        `- ✅ ≥15% ECE reduction: ${comparison.summary.meetsECETarget ? 'ACHIEVED' : 'NOT MET'}`,
        '',
        '## Conclusion',
        '',
        comparison.summary.meetsAccuracyTarget && comparison.summary.meetsBrierTarget && comparison.summary.meetsECETarget
          ? '🎉 **SUCCESS**: VOLaM-RAG meets all performance targets!'
          : '⚠️  **PARTIAL SUCCESS**: Some targets not yet achieved. Consider tuning α, β, γ parameters.'
      ];

      const summaryFile = `comparison-summary-${timestamp}.md`;
      await fs.writeFile(path.join(this.resultsDir, summaryFile), summaryLines.join('\n'));

      console.log(`📊 Comparison report saved to: ${comparisonFile}`);
      console.log(`📋 Summary report saved to: ${summaryFile}`);

      // Print key results to console
      console.log('\n🎯 COMPARISON RESULTS:');
      console.log(`Accuracy improvement: ${comparison.improvements.accuracyDelta >= 0 ? '+' : ''}${(comparison.improvements.accuracyDelta * 100).toFixed(1)}%`);
      console.log(`Brier score improvement: ${comparison.improvements.brierScoreImprovement.toFixed(1)}%`);
      console.log(`ECE improvement: ${comparison.improvements.eceImprovement.toFixed(1)}%`);

    } catch (error) {
      console.error('❌ Failed to generate comparison report:', error);
    }
  }
}

// Run the VOLaM evaluation
const evaluator = new VOLaMEvaluator();
evaluator.run();
