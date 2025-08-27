import Ajv from 'ajv';
import { Evidence, Concept, EmpathyProfile } from '../types/core.js';

// Import JSON schemas
import evidenceSchema from '../schemas/evidence.schema.json' assert { type: 'json' };
import conceptSchema from '../schemas/concept.schema.json' assert { type: 'json' };
import empathyProfileSchema from '../schemas/empathy-profile.schema.json' assert { type: 'json' };

// Initialize AJV
const ajv = new Ajv({ allErrors: true });

// Compile validators
const evidenceValidator = ajv.compile(evidenceSchema);
const conceptValidator = ajv.compile(conceptSchema);
const empathyProfileValidator = ajv.compile(empathyProfileSchema);

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validates an Evidence object against the JSON schema
 * @param data - The data to validate
 * @returns Validation result with errors if invalid
 */
export function validateEvidenceData(data: unknown): ValidationResult {
  const valid = evidenceValidator(data);
  if (valid) {
    return { valid: true };
  }
  
  const errors = evidenceValidator.errors?.map(error => {
    const path = error.schemaPath || 'root';
    return `${path}: ${error.message}`;
  }) || ['Unknown validation error'];
  
  return { valid: false, errors };
}

/**
 * Validates a Concept object against the JSON schema
 * @param data - The data to validate
 * @returns Validation result with errors if invalid
 */
export function validateConceptData(data: unknown): ValidationResult {
  const valid = conceptValidator(data);
  if (valid) {
    return { valid: true };
  }
  
  const errors = conceptValidator.errors?.map(error => {
    const path = error.schemaPath || 'root';
    return `${path}: ${error.message}`;
  }) || ['Unknown validation error'];
  
  return { valid: false, errors };
}

/**
 * Validates an EmpathyProfile object against the JSON schema
 * @param data - The data to validate
 * @returns Validation result with errors if invalid
 */
export function validateEmpathyProfileData(data: unknown): ValidationResult {
  const valid = empathyProfileValidator(data);
  if (valid) {
    return { valid: true };
  }
  
  const errors = empathyProfileValidator.errors?.map(error => {
    const path = error.schemaPath || 'root';
    return `${path}: ${error.message}`;
  }) || ['Unknown validation error'];
  
  return { valid: false, errors };
}

/**
 * Type-safe Evidence validator that combines schema validation with type guards
 * @param data - The data to validate
 * @returns The data as Evidence if valid, throws error if invalid
 */
export function validateEvidence(data: unknown): Evidence {
  const result = validateEvidenceData(data);
  if (!result.valid) {
    throw new Error(`Evidence validation failed: ${result.errors?.join(', ')}`);
  }
  return data as Evidence;
}

/**
 * Type-safe Concept validator that combines schema validation with type guards
 * @param data - The data to validate
 * @returns The data as Concept if valid, throws error if invalid
 */
export function validateConcept(data: unknown): Concept {
  const result = validateConceptData(data);
  if (!result.valid) {
    throw new Error(`Concept validation failed: ${result.errors?.join(', ')}`);
  }
  return data as Concept;
}

/**
 * Type-safe EmpathyProfile validator that combines schema validation with type guards
 * @param data - The data to validate
 * @returns The data as EmpathyProfile if valid, throws error if invalid
 */
export function validateEmpathyProfile(data: unknown): EmpathyProfile {
  const result = validateEmpathyProfileData(data);
  if (!result.valid) {
    throw new Error(`EmpathyProfile validation failed: ${result.errors?.join(', ')}`);
  }
  return data as EmpathyProfile;
}

/**
 * Serializes an Evidence object to JSON with validation
 * @param evidence - The Evidence object to serialize
 * @returns JSON string representation
 */
export function serializeEvidence(evidence: Evidence): string {
  const result = validateEvidenceData(evidence);
  if (!result.valid) {
    throw new Error(`Cannot serialize invalid Evidence: ${result.errors?.join(', ')}`);
  }
  return JSON.stringify(evidence);
}

/**
 * Deserializes JSON to an Evidence object with validation
 * @param json - The JSON string to deserialize
 * @returns Validated Evidence object
 */
export function deserializeEvidence(json: string): Evidence {
  try {
    const data = JSON.parse(json);
    return validateEvidence(data);
  } catch (error) {
    throw new Error(`Failed to deserialize Evidence: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Serializes a Concept object to JSON with validation
 * @param concept - The Concept object to serialize
 * @returns JSON string representation
 */
export function serializeConcept(concept: Concept): string {
  const result = validateConceptData(concept);
  if (!result.valid) {
    throw new Error(`Cannot serialize invalid Concept: ${result.errors?.join(', ')}`);
  }
  return JSON.stringify(concept);
}

/**
 * Deserializes JSON to a Concept object with validation
 * @param json - The JSON string to deserialize
 * @returns Validated Concept object
 */
export function deserializeConcept(json: string): Concept {
  try {
    const data = JSON.parse(json);
    return validateConcept(data);
  } catch (error) {
    throw new Error(`Failed to deserialize Concept: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Serializes an EmpathyProfile object to JSON with validation
 * @param profile - The EmpathyProfile object to serialize
 * @returns JSON string representation
 */
export function serializeEmpathyProfile(profile: EmpathyProfile): string {
  const result = validateEmpathyProfileData(profile);
  if (!result.valid) {
    throw new Error(`Cannot serialize invalid EmpathyProfile: ${result.errors?.join(', ')}`);
  }
  return JSON.stringify(profile);
}

/**
 * Deserializes JSON to an EmpathyProfile object with validation
 * @param json - The JSON string to deserialize
 * @returns Validated EmpathyProfile object
 */
export function deserializeEmpathyProfile(json: string): EmpathyProfile {
  try {
    const data = JSON.parse(json);
    return validateEmpathyProfile(data);
  } catch (error) {
    throw new Error(`Failed to deserialize EmpathyProfile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
