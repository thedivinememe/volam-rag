import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalQuestions: number;
    domainDistribution: Record<string, number>;
    citationCount: number;
    missingCorpusFiles: string[];
  };
}

/**
 * Validates Q/A dataset against JSON schema and checks corpus file references
 */
export async function validateQADataset(
  datasetPath: string = 'data/evaluation/qa-dataset.json',
  schemaPath: string = 'data/evaluation/qa-schema.json'
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalQuestions: 0,
      domainDistribution: {},
      citationCount: 0,
      missingCorpusFiles: []
    }
  };

  try {
    // Load schema and dataset
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

    // Validate against JSON schema
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const isSchemaValid = validate(dataset);

    if (!isSchemaValid && validate.errors) {
      result.isValid = false;
      result.errors.push(...validate.errors.map(err => 
        `Schema validation error: ${err.instancePath} ${err.message}`
      ));
    }

    // Collect statistics
    result.stats.totalQuestions = dataset.questions?.length || 0;
    
    // Check domain distribution
    for (const question of dataset.questions || []) {
      const domain = question.domain;
      result.stats.domainDistribution[domain] = (result.stats.domainDistribution[domain] || 0) + 1;
      
      // Count citations
      result.stats.citationCount += question.citations?.length || 0;
      
      // Check corpus file references
      for (const citation of question.citations || []) {
        const sourceFile = citation.sourceFile || citation.source;
        if (sourceFile) {
          const corpusPath = path.join('data/corpus', sourceFile);
          if (!fs.existsSync(corpusPath)) {
            result.stats.missingCorpusFiles.push(sourceFile);
            result.errors.push(`Missing corpus file: ${sourceFile} (referenced in ${question.id})`);
            result.isValid = false;
          }
        }
      }
    }

    // Validate domain distribution requirements
    const expectedDistribution = {
      hotel: { min: 20, max: 20 },
      'web-dev': { min: 20, max: 20 },
      'null-not-null': { min: 10, max: 10 }
    };

    for (const [domain, expected] of Object.entries(expectedDistribution)) {
      const actual = result.stats.domainDistribution[domain] || 0;
      if (actual < expected.min) {
        result.warnings.push(`Domain '${domain}': has ${actual} questions, expected ${expected.min}`);
      } else if (actual > expected.max) {
        result.errors.push(`Domain '${domain}': has ${actual} questions, maximum allowed is ${expected.max}`);
        result.isValid = false;
      }
    }

    // Check for unexpected domains
    for (const domain of Object.keys(result.stats.domainDistribution)) {
      if (!expectedDistribution[domain as keyof typeof expectedDistribution]) {
        result.errors.push(`Unexpected domain: '${domain}'`);
        result.isValid = false;
      }
    }

    // Validate question ID patterns
    for (const question of dataset.questions || []) {
      const expectedPattern = {
        hotel: /^hotel-\d{3}$/,
        'web-dev': /^web-dev-\d{3}$/,
        'null-not-null': /^nn-\d{3}$/
      };

      const pattern = expectedPattern[question.domain as keyof typeof expectedPattern];
      if (pattern && !pattern.test(question.id)) {
        result.errors.push(`Invalid question ID format: '${question.id}' for domain '${question.domain}'`);
        result.isValid = false;
      }
    }

    // Check for duplicate question IDs
    const questionIds = new Set();
    for (const question of dataset.questions || []) {
      if (questionIds.has(question.id)) {
        result.errors.push(`Duplicate question ID: '${question.id}'`);
        result.isValid = false;
      }
      questionIds.add(question.id);
    }

    // Remove duplicate missing files
    result.stats.missingCorpusFiles = [...new Set(result.stats.missingCorpusFiles)];

  } catch (error) {
    result.isValid = false;
    result.errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * CLI interface for validation
 */
async function main() {
  const datasetPath = process.argv[2] || 'data/evaluation/qa-dataset.json';
  const schemaPath = process.argv[3] || 'data/evaluation/qa-schema.json';

  console.log('🔍 Validating Q/A Dataset...');
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Schema: ${schemaPath}`);
  console.log('');

  const result = await validateQADataset(datasetPath, schemaPath);

  // Print statistics
  console.log('📊 Statistics:');
  console.log(`  Total questions: ${result.stats.totalQuestions}`);
  console.log(`  Total citations: ${result.stats.citationCount}`);
  console.log('  Domain distribution:');
  for (const [domain, count] of Object.entries(result.stats.domainDistribution)) {
    console.log(`    ${domain}: ${count}`);
  }
  console.log('');

  // Print warnings
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
    console.log('');
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    console.log('');
  }

  // Print result
  if (result.isValid) {
    console.log('✅ Validation passed!');
    process.exit(0);
  } else {
    console.log('❌ Validation failed!');
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
