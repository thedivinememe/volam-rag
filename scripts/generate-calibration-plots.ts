#!/usr/bin/env tsx

/**
 * Calibration plot generation script: Create confidence calibration plots
 * Usage: npm run plots:calibration
 */

import { promises as fs } from 'fs';
import path from 'path';

interface EvaluationResult {
  questionId: string;
  confidence: number;
  accuracy: number;
  correct: boolean;
  brierScore: number;
  volamScore?: number;
  nullness?: number;
  empathyFit?: number;
}

interface CalibrationBin {
  binLower: number;
  binUpper: number;
  avgConfidence: number;
  avgAccuracy: number;
  count: number;
  weight: number;
}

class CalibrationPlotGenerator {
  private resultsDir = path.join(process.cwd(), 'reports');
  private plotsDir = path.join(this.resultsDir, 'plots');

  async run(): Promise<void> {
    console.log('📊 Generating calibration plots...');

    try {
      await this.ensurePlotsDir();
      
      // Find latest baseline and VOLaM results
      const baselineResults = await this.loadLatestResults('baseline');
      const volamResults = await this.loadLatestResults('volam');

      if (baselineResults) {
        await this.generateCalibrationPlot(baselineResults, 'baseline');
        await this.generateReliabilityDiagram(baselineResults, 'baseline');
      }

      if (volamResults) {
        await this.generateCalibrationPlot(volamResults, 'volam');
        await this.generateReliabilityDiagram(volamResults, 'volam');
      }

      if (baselineResults && volamResults) {
        await this.generateComparisonPlot(baselineResults, volamResults);
      }

      console.log('✅ Calibration plots generated successfully!');
    } catch (error) {
      console.error('❌ Failed to generate calibration plots:', error);
      process.exit(1);
    }
  }

  private async ensurePlotsDir(): Promise<void> {
    await fs.mkdir(this.plotsDir, { recursive: true });
  }

  private async loadLatestResults(mode: string): Promise<EvaluationResult[] | null> {
    try {
      const files = await fs.readdir(this.resultsDir);
      const resultFiles = files
        .filter(f => f.startsWith(`${mode}-evaluation-`) && f.endsWith('.json'))
        .sort()
        .reverse();

      if (resultFiles.length === 0) {
        console.log(`⚠️  No ${mode} results found`);
        return null;
      }

      const latestFile = resultFiles[0];
      const content = await fs.readFile(path.join(this.resultsDir, latestFile), 'utf-8');
      const report = JSON.parse(content);

      console.log(`📝 Loaded ${mode} results from: ${latestFile}`);
      return report.results;
    } catch (error) {
      console.error(`❌ Failed to load ${mode} results:`, error);
      return null;
    }
  }

  private calculateCalibrationBins(results: EvaluationResult[], numBins: number = 10): CalibrationBin[] {
    const binSize = 1.0 / numBins;
    const bins: CalibrationBin[] = [];

    for (let i = 0; i < numBins; i++) {
      const binLower = i * binSize;
      const binUpper = (i + 1) * binSize;
      
      const binResults = results.filter(r => 
        r.confidence >= binLower && r.confidence < binUpper
      );

      if (binResults.length > 0) {
        const avgConfidence = binResults.reduce((sum, r) => sum + r.confidence, 0) / binResults.length;
        const avgAccuracy = binResults.reduce((sum, r) => sum + r.accuracy, 0) / binResults.length;
        const weight = binResults.length / results.length;

        bins.push({
          binLower,
          binUpper,
          avgConfidence,
          avgAccuracy,
          count: binResults.length,
          weight
        });
      }
    }

    return bins;
  }

  private async generateCalibrationPlot(results: EvaluationResult[], mode: string): Promise<void> {
    const bins = this.calculateCalibrationBins(results);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate SVG plot data
    const svgContent = this.createCalibrationSVG(bins, mode);
    const svgFilename = `calibration-${mode}-${timestamp}.svg`;
    await fs.writeFile(path.join(this.plotsDir, svgFilename), svgContent);

    // Generate CSV data for external plotting tools
    const csvContent = this.createCalibrationCSV(bins);
    const csvFilename = `calibration-${mode}-${timestamp}.csv`;
    await fs.writeFile(path.join(this.plotsDir, csvFilename), csvContent);

    console.log(`📈 Calibration plot saved: ${svgFilename}`);
    console.log(`📊 Calibration data saved: ${csvFilename}`);
  }

  private async generateReliabilityDiagram(results: EvaluationResult[], mode: string): Promise<void> {
    const bins = this.calculateCalibrationBins(results);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate reliability diagram SVG
    const svgContent = this.createReliabilityDiagramSVG(bins, mode);
    const svgFilename = `reliability-${mode}-${timestamp}.svg`;
    await fs.writeFile(path.join(this.plotsDir, svgFilename), svgContent);

    console.log(`📈 Reliability diagram saved: ${svgFilename}`);
  }

  private async generateComparisonPlot(baselineResults: EvaluationResult[], volamResults: EvaluationResult[]): Promise<void> {
    const baselineBins = this.calculateCalibrationBins(baselineResults);
    const volamBins = this.calculateCalibrationBins(volamResults);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate comparison SVG
    const svgContent = this.createComparisonSVG(baselineBins, volamBins);
    const svgFilename = `calibration-comparison-${timestamp}.svg`;
    await fs.writeFile(path.join(this.plotsDir, svgFilename), svgContent);

    console.log(`📈 Comparison plot saved: ${svgFilename}`);
  }

  private createCalibrationSVG(bins: CalibrationBin[], mode: string): string {
    const width = 500;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    let points = '';
    let bars = '';

    bins.forEach(bin => {
      const x = margin.left + (bin.avgConfidence * plotWidth);
      const y = margin.top + ((1 - bin.avgAccuracy) * plotHeight);
      const barHeight = bin.weight * plotHeight * 5; // Scale for visibility
      
      points += `<circle cx="${x}" cy="${y}" r="4" fill="#2563eb" opacity="0.7"/>`;
      bars += `<rect x="${x-2}" y="${height - margin.bottom}" width="4" height="${barHeight}" fill="#94a3b8" opacity="0.5"/>`;
    });

    // Perfect calibration line
    const perfectLine = `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${margin.top}" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,5"/>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font: bold 16px sans-serif; text-anchor: middle; }
    .axis-label { font: 12px sans-serif; text-anchor: middle; }
    .tick-label { font: 10px sans-serif; text-anchor: middle; }
  </style>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>
  
  <!-- Plot area -->
  <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="#e5e7eb"/>
  
  <!-- Grid lines -->
  ${Array.from({length: 6}, (_, i) => {
    const pos = margin.left + (i * plotWidth / 5);
    return `<line x1="${pos}" y1="${margin.top}" x2="${pos}" y2="${height - margin.bottom}" stroke="#f3f4f6"/>`;
  }).join('')}
  ${Array.from({length: 6}, (_, i) => {
    const pos = margin.top + (i * plotHeight / 5);
    return `<line x1="${margin.left}" y1="${pos}" x2="${width - margin.right}" y2="${pos}" stroke="#f3f4f6"/>`;
  }).join('')}
  
  <!-- Histogram bars -->
  ${bars}
  
  <!-- Perfect calibration line -->
  ${perfectLine}
  
  <!-- Data points -->
  ${points}
  
  <!-- Axes -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="black"/>
  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="black"/>
  
  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 10}" class="axis-label">Confidence</text>
  <text x="20" y="${height / 2}" class="axis-label" transform="rotate(-90, 20, ${height / 2})">Accuracy</text>
  
  <!-- Tick labels -->
  ${Array.from({length: 6}, (_, i) => {
    const x = margin.left + (i * plotWidth / 5);
    const label = (i * 0.2).toFixed(1);
    return `<text x="${x}" y="${height - margin.bottom + 15}" class="tick-label">${label}</text>`;
  }).join('')}
  ${Array.from({length: 6}, (_, i) => {
    const y = height - margin.bottom - (i * plotHeight / 5);
    const label = (i * 0.2).toFixed(1);
    return `<text x="${margin.left - 10}" y="${y + 3}" class="tick-label" text-anchor="end">${label}</text>`;
  }).join('')}
  
  <!-- Title -->
  <text x="${width / 2}" y="25" class="title">Calibration Plot - ${mode.toUpperCase()}</text>
  
  <!-- Legend -->
  <circle cx="${width - 120}" cy="60" r="4" fill="#2563eb"/>
  <text x="${width - 110}" y="65" class="tick-label">Observed</text>
  <line x1="${width - 120}" y1="80" x2="${width - 100}" y2="80" stroke="#ef4444" stroke-dasharray="3,3"/>
  <text x="${width - 95}" y="85" class="tick-label">Perfect</text>
</svg>`;
  }

  private createReliabilityDiagramSVG(bins: CalibrationBin[], mode: string): string {
    const width = 500;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    let bars = '';
    const barWidth = plotWidth / bins.length;

    bins.forEach((bin, i) => {
      const x = margin.left + (i * barWidth);
      const accuracyHeight = bin.avgAccuracy * plotHeight;
      const confidenceHeight = bin.avgConfidence * plotHeight;
      
      // Accuracy bar (blue)
      bars += `<rect x="${x + 2}" y="${height - margin.bottom - accuracyHeight}" width="${barWidth/2 - 2}" height="${accuracyHeight}" fill="#2563eb" opacity="0.7"/>`;
      
      // Confidence bar (red)
      bars += `<rect x="${x + barWidth/2}" y="${height - margin.bottom - confidenceHeight}" width="${barWidth/2 - 2}" height="${confidenceHeight}" fill="#ef4444" opacity="0.7"/>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font: bold 16px sans-serif; text-anchor: middle; }
    .axis-label { font: 12px sans-serif; text-anchor: middle; }
    .tick-label { font: 10px sans-serif; text-anchor: middle; }
  </style>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>
  
  <!-- Plot area -->
  <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="#e5e7eb"/>
  
  <!-- Bars -->
  ${bars}
  
  <!-- Axes -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="black"/>
  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="black"/>
  
  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 10}" class="axis-label">Confidence Bins</text>
  <text x="20" y="${height / 2}" class="axis-label" transform="rotate(-90, 20, ${height / 2})">Proportion</text>
  
  <!-- Y-axis tick labels -->
  ${Array.from({length: 6}, (_, i) => {
    const y = height - margin.bottom - (i * plotHeight / 5);
    const label = (i * 0.2).toFixed(1);
    return `<text x="${margin.left - 10}" y="${y + 3}" class="tick-label" text-anchor="end">${label}</text>`;
  }).join('')}
  
  <!-- Title -->
  <text x="${width / 2}" y="25" class="title">Reliability Diagram - ${mode.toUpperCase()}</text>
  
  <!-- Legend -->
  <rect x="${width - 120}" y="55" width="15" height="10" fill="#2563eb" opacity="0.7"/>
  <text x="${width - 100}" y="65" class="tick-label">Accuracy</text>
  <rect x="${width - 120}" y="75" width="15" height="10" fill="#ef4444" opacity="0.7"/>
  <text x="${width - 100}" y="85" class="tick-label">Confidence</text>
</svg>`;
  }

  private createComparisonSVG(baselineBins: CalibrationBin[], volamBins: CalibrationBin[]): string {
    const width = 500;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    let baselinePoints = '';
    let volamPoints = '';

    baselineBins.forEach(bin => {
      const x = margin.left + (bin.avgConfidence * plotWidth);
      const y = margin.top + ((1 - bin.avgAccuracy) * plotHeight);
      baselinePoints += `<circle cx="${x}" cy="${y}" r="4" fill="#ef4444" opacity="0.7"/>`;
    });

    volamBins.forEach(bin => {
      const x = margin.left + (bin.avgConfidence * plotWidth);
      const y = margin.top + ((1 - bin.avgAccuracy) * plotHeight);
      volamPoints += `<circle cx="${x}" cy="${y}" r="4" fill="#2563eb" opacity="0.7"/>`;
    });

    // Perfect calibration line
    const perfectLine = `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${margin.top}" stroke="#6b7280" stroke-width="2" stroke-dasharray="5,5"/>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font: bold 16px sans-serif; text-anchor: middle; }
    .axis-label { font: 12px sans-serif; text-anchor: middle; }
    .tick-label { font: 10px sans-serif; text-anchor: middle; }
  </style>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>
  
  <!-- Plot area -->
  <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="#e5e7eb"/>
  
  <!-- Grid lines -->
  ${Array.from({length: 6}, (_, i) => {
    const pos = margin.left + (i * plotWidth / 5);
    return `<line x1="${pos}" y1="${margin.top}" x2="${pos}" y2="${height - margin.bottom}" stroke="#f3f4f6"/>`;
  }).join('')}
  ${Array.from({length: 6}, (_, i) => {
    const pos = margin.top + (i * plotHeight / 5);
    return `<line x1="${margin.left}" y1="${pos}" x2="${width - margin.right}" y2="${pos}" stroke="#f3f4f6"/>`;
  }).join('')}
  
  <!-- Perfect calibration line -->
  ${perfectLine}
  
  <!-- Data points -->
  ${baselinePoints}
  ${volamPoints}
  
  <!-- Axes -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="black"/>
  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="black"/>
  
  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 10}" class="axis-label">Confidence</text>
  <text x="20" y="${height / 2}" class="axis-label" transform="rotate(-90, 20, ${height / 2})">Accuracy</text>
  
  <!-- Tick labels -->
  ${Array.from({length: 6}, (_, i) => {
    const x = margin.left + (i * plotWidth / 5);
    const label = (i * 0.2).toFixed(1);
    return `<text x="${x}" y="${height - margin.bottom + 15}" class="tick-label">${label}</text>`;
  }).join('')}
  ${Array.from({length: 6}, (_, i) => {
    const y = height - margin.bottom - (i * plotHeight / 5);
    const label = (i * 0.2).toFixed(1);
    return `<text x="${margin.left - 10}" y="${y + 3}" class="tick-label" text-anchor="end">${label}</text>`;
  }).join('')}
  
  <!-- Title -->
  <text x="${width / 2}" y="25" class="title">Calibration Comparison: Baseline vs VOLaM</text>
  
  <!-- Legend -->
  <circle cx="${width - 120}" cy="60" r="4" fill="#ef4444"/>
  <text x="${width - 110}" y="65" class="tick-label">Baseline</text>
  <circle cx="${width - 120}" cy="80" r="4" fill="#2563eb"/>
  <text x="${width - 110}" y="85" class="tick-label">VOLaM</text>
  <line x1="${width - 120}" y1="100" x2="${width - 100}" y2="100" stroke="#6b7280" stroke-dasharray="3,3"/>
  <text x="${width - 95}" y="105" class="tick-label">Perfect</text>
</svg>`;
  }

  private createCalibrationCSV(bins: CalibrationBin[]): string {
    const headers = 'bin_lower,bin_upper,avg_confidence,avg_accuracy,count,weight';
    const rows = bins.map(bin => 
      `${bin.binLower.toFixed(3)},${bin.binUpper.toFixed(3)},${bin.avgConfidence.toFixed(3)},${bin.avgAccuracy.toFixed(3)},${bin.count},${bin.weight.toFixed(3)}`
    );
    return [headers, ...rows].join('\n');
  }
}

// Run the calibration plot generator
const generator = new CalibrationPlotGenerator();
generator.run();
