#!/usr/bin/env tsx

/**
 * Enhanced comparison report generator for VOLaM-RAG
 * Generates detailed comparison between baseline and VOLaM with empathy/certainty analysis
 * Usage: npm run comparison-report [--with-plots]
 */

import { promises as fs } from 'fs';
import path from 'path';

interface EvaluationMetrics {
  accuracy: number;
  brierScore: number;
  ece: number;
  volamScore?: number;
  nullness?: number;
  empathyFit?: number;
}

interface EvaluationResult {
  questionId: string;
  query: string;
  accuracy: number;
  confidence: number;
  brierScore: number;
  volamScore?: number;
  nullness?: number;
  empathyFit?: number;
  correct: boolean;
}

interface EvaluationReport {
  mode: string;
  metrics: EvaluationMetrics;
  results: EvaluationResult[];
  generatedAt: string;
}

interface DomainAnalysis {
  domain: string;
  baseline: EvaluationMetrics;
  volam: EvaluationMetrics;
  improvements: {
    accuracyDelta: number;
    brierScoreDelta: number;
    eceDelta: number;
  };
}

interface ParameterAnalysis {
  alpha: number;
  beta: number;
  gamma: number;
  cosineContribution: number;
  certaintyContribution: number;
  empathyContribution: number;
  effectiveWeight: {
    cosine: number;
    certainty: number;
    empathy: number;
  };
}

class EnhancedComparisonReportGenerator {
  private resultsDir = path.join(process.cwd(), 'reports');
  private plotsDir = path.join(this.resultsDir, 'plots');
  private withPlots: boolean;

  constructor(withPlots: boolean = false) {
    this.withPlots = withPlots;
  }

  async generate(): Promise<void> {
    console.log('📊 Generating enhanced comparison report...');

    try {
      const { baselineReport, volamReport } = await this.loadLatestReports();
      const domainAnalysis = await this.analyzeDomainPerformance(baselineReport, volamReport);
      const parameterAnalysis = this.analyzeParameterContributions(volamReport);
      const plotPaths = this.withPlots ? await this.findLatestPlots() : {};

      const report = await this.generateEnhancedReport(
        baselineReport,
        volamReport,
        domainAnalysis,
        parameterAnalysis,
        plotPaths
      );

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `enhanced-comparison-report-${timestamp}.md`;
      const filepath = path.join(this.resultsDir, filename);

      await fs.writeFile(filepath, report);
      console.log(`✅ Enhanced comparison report saved to: ${filename}`);

      // Also save JSON data for programmatic access
      const jsonData = {
        timestamp,
        baseline: baselineReport.metrics,
        volam: volamReport.metrics,
        domainAnalysis,
        parameterAnalysis,
        generatedAt: new Date().toISOString()
      };

      const jsonFilename = `enhanced-comparison-data-${timestamp}.json`;
      await fs.writeFile(
        path.join(this.resultsDir, jsonFilename),
        JSON.stringify(jsonData, null, 2)
      );
      console.log(`💾 Comparison data saved to: ${jsonFilename}`);

    } catch (error) {
      console.error('❌ Failed to generate enhanced comparison report:', error);
      process.exit(1);
    }
  }

  private async loadLatestReports(): Promise<{
    baselineReport: EvaluationReport;
    volamReport: EvaluationReport;
  }> {
    const files = await fs.readdir(this.resultsDir);
    
    const baselineFiles = files
      .filter(f => f.startsWith('baseline-evaluation-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    const volamFiles = files
      .filter(f => f.startsWith('volam-evaluation-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (baselineFiles.length === 0) {
      throw new Error('No baseline evaluation results found. Run "make eval-baseline" first.');
    }

    if (volamFiles.length === 0) {
      throw new Error('No VOLaM evaluation results found. Run "make eval-volam" first.');
    }

    const baselineContent = await fs.readFile(
      path.join(this.resultsDir, baselineFiles[0]),
      'utf-8'
    );
    const volamContent = await fs.readFile(
      path.join(this.resultsDir, volamFiles[0]),
      'utf-8'
    );

    const baselineReport = JSON.parse(baselineContent) as EvaluationReport;
    const volamReport = JSON.parse(volamContent) as EvaluationReport;

    console.log(`📄 Using baseline report: ${baselineFiles[0]}`);
    console.log(`📄 Using VOLaM report: ${volamFiles[0]}`);

    return { baselineReport, volamReport };
  }

  private async analyzeDomainPerformance(
    baselineReport: EvaluationReport,
    volamReport: EvaluationReport
  ): Promise<DomainAnalysis[]> {
    // Group results by domain based on question ID patterns
    const domains = ['hotel', 'web-dev', 'null-not-null'];
    const analysis: DomainAnalysis[] = [];

    for (const domain of domains) {
      const baselineResults = baselineReport.results.filter(r => 
        r.questionId.includes(domain) || r.query.toLowerCase().includes(domain.replace('-', ' '))
      );
      const volamResults = volamReport.results.filter(r => 
        r.questionId.includes(domain) || r.query.toLowerCase().includes(domain.replace('-', ' '))
      );

      if (baselineResults.length > 0 && volamResults.length > 0) {
        const baselineMetrics = this.calculateMetricsForResults(baselineResults);
        const volamMetrics = this.calculateMetricsForResults(volamResults);

        analysis.push({
          domain,
          baseline: baselineMetrics,
          volam: volamMetrics,
          improvements: {
            accuracyDelta: volamMetrics.accuracy - baselineMetrics.accuracy,
            brierScoreDelta: volamMetrics.brierScore - baselineMetrics.brierScore,
            eceDelta: volamMetrics.ece - baselineMetrics.ece
          }
        });
      }
    }

    return analysis;
  }

  private calculateMetricsForResults(results: EvaluationResult[]): EvaluationMetrics {
    const totalQuestions = results.length;
    const accuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / totalQuestions;
    const brierScore = results.reduce((sum, r) => sum + r.brierScore, 0) / totalQuestions;
    const ece = this.calculateECE(results);

    const metrics: EvaluationMetrics = { accuracy, brierScore, ece };

    // Add VOLaM-specific metrics if available
    if (results[0]?.volamScore !== undefined) {
      metrics.volamScore = results.reduce((sum, r) => sum + (r.volamScore || 0), 0) / totalQuestions;
      metrics.nullness = results.reduce((sum, r) => sum + (r.nullness || 0), 0) / totalQuestions;
      metrics.empathyFit = results.reduce((sum, r) => sum + (r.empathyFit || 0), 0) / totalQuestions;
    }

    return metrics;
  }

  private calculateECE(results: EvaluationResult[]): number {
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

  private analyzeParameterContributions(volamReport: EvaluationReport): ParameterAnalysis {
    // Default VOLaM parameters (these should ideally come from the evaluation data)
    const alpha = 0.6; // cosine weight
    const beta = 0.3;  // certainty weight (1 - nullness)
    const gamma = 0.1; // empathy weight

    const results = volamReport.results;
    const avgCosineScore = results.reduce((sum, r) => {
      // Estimate cosine component from VOLaM score
      const volamScore = r.volamScore || 0;
      const nullness = r.nullness || 0;
      const empathyFit = r.empathyFit || 0;
      const certainty = 1 - nullness;
      
      // Reverse engineer cosine score: VOLaM = α·cosine + β·certainty + γ·empathy
      const cosineEstimate = (volamScore - beta * certainty - gamma * empathyFit) / alpha;
      return sum + Math.max(0, Math.min(1, cosineEstimate)); // Clamp to [0,1]
    }, 0) / results.length;

    const avgCertainty = results.reduce((sum, r) => sum + (1 - (r.nullness || 0)), 0) / results.length;
    const avgEmpathyFit = results.reduce((sum, r) => sum + (r.empathyFit || 0), 0) / results.length;

    const cosineContribution = alpha * avgCosineScore;
    const certaintyContribution = beta * avgCertainty;
    const empathyContribution = gamma * avgEmpathyFit;

    const totalContribution = cosineContribution + certaintyContribution + empathyContribution;

    return {
      alpha,
      beta,
      gamma,
      cosineContribution,
      certaintyContribution,
      empathyContribution,
      effectiveWeight: {
        cosine: cosineContribution / totalContribution,
        certainty: certaintyContribution / totalContribution,
        empathy: empathyContribution / totalContribution
      }
    };
  }

  private async findLatestPlots(): Promise<Record<string, string>> {
    try {
      const plotFiles = await fs.readdir(this.plotsDir);
      const latestPlots: Record<string, string> = {};

      // Find latest calibration comparison plot
      const calibrationComparison = plotFiles
        .filter(f => f.startsWith('calibration-comparison-') && f.endsWith('.svg'))
        .sort()
        .reverse()[0];

      if (calibrationComparison) {
        latestPlots.calibrationComparison = `plots/${calibrationComparison}`;
      }

      // Find latest reliability plots
      const reliabilityBaseline = plotFiles
        .filter(f => f.startsWith('reliability-baseline-') && f.endsWith('.svg'))
        .sort()
        .reverse()[0];

      const reliabilityVolam = plotFiles
        .filter(f => f.startsWith('reliability-volam-') && f.endsWith('.svg'))
        .sort()
        .reverse()[0];

      if (reliabilityBaseline) latestPlots.reliabilityBaseline = `plots/${reliabilityBaseline}`;
      if (reliabilityVolam) latestPlots.reliabilityVolam = `plots/${reliabilityVolam}`;

      return latestPlots;
    } catch (error) {
      console.warn('⚠️  Could not load plot files:', error);
      return {};
    }
  }

  private async generateEnhancedReport(
    baselineReport: EvaluationReport,
    volamReport: EvaluationReport,
    domainAnalysis: DomainAnalysis[],
    parameterAnalysis: ParameterAnalysis,
    plotPaths: Record<string, string>
  ): Promise<string> {
    const baseline = baselineReport.metrics;
    const volam = volamReport.metrics;

    const accuracyDelta = volam.accuracy - baseline.accuracy;
    const brierScoreDelta = volam.brierScore - baseline.brierScore;
    const eceDelta = volam.ece - baseline.ece;

    const accuracyImprovement = (accuracyDelta / baseline.accuracy) * 100;
    const brierScoreImprovement = ((baseline.brierScore - volam.brierScore) / baseline.brierScore) * 100;
    const eceImprovement = ((baseline.ece - volam.ece) / baseline.ece) * 100;

    const meetsAccuracyTarget = accuracyDelta >= 0.10;
    const meetsBrierTarget = brierScoreImprovement >= 15;
    const meetsECETarget = eceImprovement >= 15;

    const lines = [
      '# VOLaM-RAG Enhanced Comparison Report',
      `**Generated:** ${new Date().toISOString()}`,
      `**Baseline Report:** ${baselineReport.generatedAt}`,
      `**VOLaM Report:** ${volamReport.generatedAt}`,
      '',
      '## Executive Summary',
      '',
      'This enhanced comparison report analyzes the performance differences between the baseline cosine-similarity approach and the VOLaM (Value-Oriented Learning and Memory) algorithm. The report includes detailed analysis of empathy and certainty contributions to the overall ranking performance.',
      '',
      '## Overall Performance Comparison',
      '',
      '### Baseline (Cosine-only)',
      `- **Accuracy:** ${(baseline.accuracy * 100).toFixed(1)}%`,
      `- **Brier Score:** ${baseline.brierScore.toFixed(3)}`,
      `- **ECE:** ${baseline.ece.toFixed(3)}`,
      '',
      '### VOLaM Algorithm',
      `- **Accuracy:** ${(volam.accuracy * 100).toFixed(1)}%`,
      `- **Brier Score:** ${volam.brierScore.toFixed(3)}`,
      `- **ECE:** ${volam.ece.toFixed(3)}`,
      `- **Average VOLaM Score:** ${(volam.volamScore || 0).toFixed(3)}`,
      `- **Average Nullness:** ${(volam.nullness || 0).toFixed(3)}`,
      `- **Average Empathy Fit:** ${(volam.empathyFit || 0).toFixed(3)}`,
      '',
      '### Performance Improvements',
      '',
      `| Metric | Baseline | VOLaM | Δ Absolute | Δ Relative | Target | Status |`,
      `|--------|----------|-------|------------|------------|---------|---------|`,
      `| **Accuracy** | ${(baseline.accuracy * 100).toFixed(1)}% | ${(volam.accuracy * 100).toFixed(1)}% | ${accuracyDelta >= 0 ? '+' : ''}${(accuracyDelta * 100).toFixed(1)}% | ${accuracyImprovement >= 0 ? '+' : ''}${accuracyImprovement.toFixed(1)}% | +10% | ${meetsAccuracyTarget ? '✅' : '❌'} |`,
      `| **Brier Score** | ${baseline.brierScore.toFixed(3)} | ${volam.brierScore.toFixed(3)} | ${brierScoreDelta <= 0 ? '' : '+'}${brierScoreDelta.toFixed(3)} | ${brierScoreImprovement >= 0 ? '+' : ''}${brierScoreImprovement.toFixed(1)}% | ≥15% reduction | ${meetsBrierTarget ? '✅' : '❌'} |`,
      `| **ECE** | ${baseline.ece.toFixed(3)} | ${volam.ece.toFixed(3)} | ${eceDelta <= 0 ? '' : '+'}${eceDelta.toFixed(3)} | ${eceImprovement >= 0 ? '+' : ''}${eceImprovement.toFixed(1)}% | ≥15% reduction | ${meetsECETarget ? '✅' : '❌'} |`,
      '',
      '## VOLaM Component Analysis 🎯',
      '',
      '### Parameter Configuration',
      `- **α (Cosine Weight):** ${parameterAnalysis.alpha}`,
      `- **β (Certainty Weight):** ${parameterAnalysis.beta}`,
      `- **γ (Empathy Weight):** ${parameterAnalysis.gamma}`,
      '',
      '### Component Contributions',
      '',
      `| Component | Raw Contribution | Effective Weight | Analysis |`,
      `|-----------|------------------|------------------|----------|`,
      `| **Cosine Similarity** | ${parameterAnalysis.cosineContribution.toFixed(3)} | ${(parameterAnalysis.effectiveWeight.cosine * 100).toFixed(1)}% | ${this.analyzeComponentImpact('cosine', parameterAnalysis.effectiveWeight.cosine)} |`,
      `| **Certainty (1-nullness)** | ${parameterAnalysis.certaintyContribution.toFixed(3)} | ${(parameterAnalysis.effectiveWeight.certainty * 100).toFixed(1)}% | ${this.analyzeComponentImpact('certainty', parameterAnalysis.effectiveWeight.certainty)} |`,
      `| **Empathy Fit** | ${parameterAnalysis.empathyContribution.toFixed(3)} | ${(parameterAnalysis.effectiveWeight.empathy * 100).toFixed(1)}% | ${this.analyzeComponentImpact('empathy', parameterAnalysis.effectiveWeight.empathy)} |`,
      '',
      '### Empathy Contribution Analysis',
      '',
      `The empathy component (γ = ${parameterAnalysis.gamma}) contributes ${(parameterAnalysis.effectiveWeight.empathy * 100).toFixed(1)}% to the final ranking score. ` +
      `With an average empathy fit of ${(volam.empathyFit || 0).toFixed(3)}, this suggests ${this.interpretEmpathyFit(volam.empathyFit || 0)}.`,
      '',
      `**Empathy Impact:** ${this.assessEmpathyImpact(parameterAnalysis.effectiveWeight.empathy, volam.empathyFit || 0)}`,
      '',
      '### Certainty Contribution Analysis',
      '',
      `The certainty component (β = ${parameterAnalysis.beta}) contributes ${(parameterAnalysis.effectiveWeight.certainty * 100).toFixed(1)}% to the final ranking score. ` +
      `With an average nullness of ${(volam.nullness || 0).toFixed(3)} (certainty: ${(1 - (volam.nullness || 0)).toFixed(3)}), this indicates ${this.interpretCertainty(1 - (volam.nullness || 0))}.`,
      '',
      `**Certainty Impact:** ${this.assessCertaintyImpact(parameterAnalysis.effectiveWeight.certainty, 1 - (volam.nullness || 0))}`,
      ''
    ];

    // Add domain analysis if available
    if (domainAnalysis.length > 0) {
      lines.push(
        '## Domain-Specific Performance',
        '',
        '| Domain | Baseline Acc. | VOLaM Acc. | Δ Accuracy | Δ Brier | Δ ECE |',
        '|--------|---------------|------------|------------|---------|-------|'
      );

      domainAnalysis.forEach(domain => {
        lines.push(
          `| **${domain.domain}** | ${(domain.baseline.accuracy * 100).toFixed(1)}% | ${(domain.volam.accuracy * 100).toFixed(1)}% | ${domain.improvements.accuracyDelta >= 0 ? '+' : ''}${(domain.improvements.accuracyDelta * 100).toFixed(1)}% | ${domain.improvements.brierScoreDelta <= 0 ? '' : '+'}${domain.improvements.brierScoreDelta.toFixed(3)} | ${domain.improvements.eceDelta <= 0 ? '' : '+'}${domain.improvements.eceDelta.toFixed(3)} |`
        );
      });

      lines.push('');

      // Add domain insights
      lines.push('### Domain Insights');
      lines.push('');
      domainAnalysis.forEach(domain => {
        const insight = this.generateDomainInsight(domain);
        lines.push(`**${domain.domain}:** ${insight}`);
        lines.push('');
      });
    }

    // Add calibration analysis if plots are available
    if (Object.keys(plotPaths).length > 0) {
      lines.push(
        '## Calibration Analysis',
        ''
      );

      if (plotPaths.calibrationComparison) {
        lines.push(
          '### Calibration Comparison',
          `![Calibration Comparison](${plotPaths.calibrationComparison})`,
          ''
        );
      }

      if (plotPaths.reliabilityBaseline && plotPaths.reliabilityVolam) {
        lines.push(
          '### Reliability Diagrams',
          '',
          '#### Baseline Reliability',
          `![Baseline Reliability](${plotPaths.reliabilityBaseline})`,
          '',
          '#### VOLaM Reliability',
          `![VOLaM Reliability](${plotPaths.reliabilityVolam})`,
          ''
        );
      }
    }

    // Add recommendations
    lines.push(
      '## Recommendations',
      '',
      this.generateRecommendations(
        meetsAccuracyTarget,
        meetsBrierTarget,
        meetsECETarget,
        parameterAnalysis,
        volam
      ),
      '',
      '## Conclusion',
      '',
      meetsAccuracyTarget && meetsBrierTarget && meetsECETarget
        ? '🎉 **SUCCESS**: VOLaM-RAG meets all performance targets! The multi-factor approach successfully improves upon the baseline cosine-similarity method.'
        : '⚠️  **PARTIAL SUCCESS**: While VOLaM shows promise, some performance targets are not yet achieved. The analysis above provides specific recommendations for parameter tuning and system improvements.',
      '',
      '---',
      '*Report generated by VOLaM-RAG Enhanced Comparison System*'
    );

    return lines.join('\n');
  }

  private analyzeComponentImpact(component: string, weight: number): string {
    if (weight > 0.6) return 'Dominant influence';
    if (weight > 0.3) return 'Significant impact';
    if (weight > 0.1) return 'Moderate influence';
    return 'Minimal impact';
  }

  private interpretEmpathyFit(empathyFit: number): string {
    if (empathyFit > 0.8) return 'excellent stakeholder alignment';
    if (empathyFit > 0.6) return 'good stakeholder alignment';
    if (empathyFit > 0.4) return 'moderate stakeholder alignment';
    return 'poor stakeholder alignment';
  }

  private interpretCertainty(certainty: number): string {
    if (certainty > 0.8) return 'high confidence in evidence quality';
    if (certainty > 0.6) return 'moderate confidence in evidence quality';
    if (certainty > 0.4) return 'low confidence in evidence quality';
    return 'very low confidence in evidence quality';
  }

  private assessEmpathyImpact(weight: number, empathyFit: number): string {
    if (weight < 0.1 && empathyFit > 0.7) {
      return 'High empathy fit but low weight suggests increasing γ could improve performance';
    }
    if (weight > 0.3 && empathyFit < 0.5) {
      return 'High empathy weight but low fit suggests improving empathy modeling or reducing γ';
    }
    if (weight > 0.2 && empathyFit > 0.7) {
      return 'Good balance of empathy weight and fit contributing positively to ranking';
    }
    return 'Empathy component appears well-calibrated for current use case';
  }

  private assessCertaintyImpact(weight: number, certainty: number): string {
    if (weight < 0.2 && certainty > 0.7) {
      return 'High certainty but low weight suggests increasing β could improve performance';
    }
    if (weight > 0.4 && certainty < 0.5) {
      return 'High certainty weight but low certainty suggests improving nullness modeling or reducing β';
    }
    if (weight > 0.3 && certainty > 0.7) {
      return 'Good balance of certainty weight and values contributing positively to ranking';
    }
    return 'Certainty component appears appropriately weighted for current evidence quality';
  }

  private generateDomainInsight(domain: DomainAnalysis): string {
    const accuracyImprovement = domain.improvements.accuracyDelta * 100;
    const brierImprovement = ((domain.baseline.brierScore - domain.volam.brierScore) / domain.baseline.brierScore) * 100;

    if (accuracyImprovement > 5) {
      return `Strong performance gains (+${accuracyImprovement.toFixed(1)}% accuracy) suggest VOLaM is well-suited for this domain.`;
    }
    if (accuracyImprovement < -2) {
      return `Performance decline (-${Math.abs(accuracyImprovement).toFixed(1)}% accuracy) indicates domain-specific parameter tuning may be needed.`;
    }
    if (brierImprovement > 10) {
      return `Significant calibration improvement (+${brierImprovement.toFixed(1)}% Brier) shows better confidence estimation.`;
    }
    return `Stable performance with minimal changes suggests consistent behavior across this domain.`;
  }

  private generateRecommendations(
    meetsAccuracyTarget: boolean,
    meetsBrierTarget: boolean,
    meetsECETarget: boolean,
    parameterAnalysis: ParameterAnalysis,
    volam: EvaluationMetrics
  ): string {
    const recommendations: string[] = [];

    if (!meetsAccuracyTarget) {
      recommendations.push('**Accuracy Improvement:**');
      if (parameterAnalysis.effectiveWeight.empathy < 0.15 && (volam.empathyFit || 0) > 0.7) {
        recommendations.push('- Consider increasing γ (empathy weight) from 0.1 to 0.2-0.3 given high empathy fit');
      }
      if (parameterAnalysis.effectiveWeight.certainty < 0.25 && (1 - (volam.nullness || 0)) > 0.7) {
        recommendations.push('- Consider increasing β (certainty weight) from 0.3 to 0.4-0.5 given high certainty');
      }
      recommendations.push('- Experiment with parameter combinations: α=0.4-0.5, β=0.3-0.4, γ=0.2-0.3');
    }

    if (!meetsBrierTarget) {
      recommendations.push('**Calibration Improvement:**');
      recommendations.push('- Improve confidence estimation by incorporating nullness uncertainty');
      recommendations.push('- Consider confidence scaling based on evidence consensus');
    }

    if (!meetsECETarget) {
      recommendations.push('**Expected Calibration Error Reduction:**');
      recommendations.push('- Implement confidence binning and recalibration');
      recommendations.push('- Add uncertainty quantification to empathy and nullness components');
    }

    if (recommendations.length === 0) {
      recommendations.push('**Optimization Opportunities:**');
      recommendations.push('- Fine-tune parameters for specific domains or use cases');
      recommendations.push('- Explore adaptive parameter selection based on query characteristics');
      recommendations.push('- Consider ensemble methods combining multiple parameter configurations');
    }

    return recommendations.join('\n');
  }
}

// Parse command line arguments
function parseArgs(): { withPlots: boolean } {
  const args = process.argv.slice(2);
  const withPlots = args.includes('--with-plots');
  return { withPlots };
}

// Run the enhanced comparison report generator
async function main() {
  const { withPlots } = parseArgs();
  const generator = new EnhancedComparisonReportGenerator(withPlots);
  await generator.generate();
}

main().catch(console.error);
