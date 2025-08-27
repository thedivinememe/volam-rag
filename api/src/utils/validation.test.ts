import { Concept, EmpathyProfile, Evidence } from '../types/core.js';
import { describe, expect, it } from 'vitest';
import {
  deserializeConcept,
  deserializeEmpathyProfile,
  deserializeEvidence,
  serializeConcept,
  serializeEmpathyProfile,
  serializeEvidence,
  validateConcept,
  validateConceptData,
  validateEmpathyProfile,
  validateEmpathyProfileData,
  validateEvidence,
  validateEvidenceData
} from './validation.js';

describe('Validation Utilities', () => {
  describe('Evidence Validation', () => {
    const validEvidence: Evidence = {
      id: 'evidence-1',
      content: 'This is test evidence content',
      score: 0.85,
      cosineScore: 0.75,
      nullness: 0.2,
      empathyFit: 0.9,
      source: 'test-source',
      metadata: {
        createdAt: '2024-01-01T00:00:00.000Z',
        tags: ['test', 'validation']
      }
    };

    it('should validate correct Evidence object', () => {
      const result = validateEvidenceData(validEvidence);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject Evidence with missing required fields', () => {
      const invalidEvidence = {
        id: 'evidence-1',
        content: 'Test content'
        // Missing required fields: score, cosineScore, nullness, empathyFit, source
      };

      const result = validateEvidenceData(invalidEvidence);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject Evidence with invalid score ranges', () => {
      const invalidEvidence = {
        ...validEvidence,
        score: 1.5, // Invalid: > 1
        nullness: -0.1 // Invalid: < 0
      };

      const result = validateEvidenceData(invalidEvidence);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject Evidence with invalid types', () => {
      const invalidEvidence = {
        ...validEvidence,
        id: 123, // Should be string
        score: 'high' // Should be number
      };

      const result = validateEvidenceData(invalidEvidence);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should validate and return Evidence object', () => {
      const result = validateEvidence(validEvidence);
      expect(result).toEqual(validEvidence);
    });

    it('should throw error for invalid Evidence', () => {
      const invalidEvidence = { id: 'test' };
      expect(() => validateEvidence(invalidEvidence)).toThrow('Evidence validation failed');
    });
  });

  describe('Concept Validation', () => {
    const validConcept: Concept = {
      id: 'concept-1',
      name: 'Test Concept',
      currentNullness: 0.3,
      nullnessHistory: [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          nullness: 0.5,
          trigger: 'system_recalculation',
          context: 'Initial concept creation'
        },
        {
          timestamp: '2024-01-02T00:00:00.000Z',
          nullness: 0.3,
          trigger: 'evidence_added',
          context: 'Updated based on new evidence'
        }
      ],
      relatedEvidence: ['evidence-1', 'evidence-2'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      metadata: {
        tags: ['test', 'concept']
      }
    };

    it('should validate correct Concept object', () => {
      const result = validateConceptData(validConcept);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject Concept with missing required fields', () => {
      const invalidConcept = {
        id: 'concept-1',
        name: 'Test Concept'
        // Missing required fields: nullness, nullnessHistory, relatedEvidence
      };

      const result = validateConceptData(invalidConcept);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject Concept with invalid nullness history', () => {
      const invalidConcept = {
        ...validConcept,
        nullnessHistory: [
          {
            timestamp: 'invalid-date',
            nullness: 1.5, // Invalid: > 1
            trigger: 'invalid_trigger' // Invalid enum value
          }
        ]
      };

      const result = validateConceptData(invalidConcept);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should validate and return Concept object', () => {
      const result = validateConcept(validConcept);
      expect(result).toEqual(validConcept);
    });

    it('should throw error for invalid Concept', () => {
      const invalidConcept = { id: 'test' };
      expect(() => validateConcept(invalidConcept)).toThrow('Concept validation failed');
    });
  });

  describe('EmpathyProfile Validation', () => {
    const validEmpathyProfile: EmpathyProfile = {
      id: 'profile-1',
      name: 'Test Profile',
      description: 'A test empathy profile',
      stakeholders: {
        patients: 0.8,
        doctors: 0.6,
        administrators: 0.3,
        researchers: 0.7
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      isActive: true,
      metadata: {
        version: '1.0.0',
        tags: ['healthcare', 'test']
      }
    };

    it('should validate correct EmpathyProfile object', () => {
      const result = validateEmpathyProfileData(validEmpathyProfile);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject EmpathyProfile with missing required fields', () => {
      const invalidProfile = {
        id: 'profile-1',
        name: 'Test Profile'
        // Missing required field: stakeholderWeights
      };

      const result = validateEmpathyProfileData(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject EmpathyProfile with invalid stakeholder weights', () => {
      const invalidProfile = {
        ...validEmpathyProfile,
        stakeholderWeights: {
          patients: 1.5, // Invalid: > 1
          doctors: -0.1, // Invalid: < 0
          'invalid-key!': 0.5 // Invalid key pattern
        }
      };

      const result = validateEmpathyProfileData(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject EmpathyProfile with empty stakeholder weights', () => {
      const invalidProfile = {
        ...validEmpathyProfile,
        stakeholderWeights: {} // Empty object not allowed
      };

      const result = validateEmpathyProfileData(invalidProfile);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should validate and return EmpathyProfile object', () => {
      const result = validateEmpathyProfile(validEmpathyProfile);
      expect(result).toEqual(validEmpathyProfile);
    });

    it('should throw error for invalid EmpathyProfile', () => {
      const invalidProfile = { id: 'test' };
      expect(() => validateEmpathyProfile(invalidProfile)).toThrow('EmpathyProfile validation failed');
    });
  });

  describe('Serialization and Deserialization', () => {
    const validEvidence: Evidence = {
      id: 'evidence-1',
      content: 'Test evidence',
      score: 0.8,
      cosineScore: 0.7,
      nullness: 0.2,
      empathyFit: 0.9,
      source: 'test-source',
      metadata: {}
    };

    const validConcept: Concept = {
      id: 'concept-1',
      name: 'Test Concept',
      currentNullness: 0.3,
      nullnessHistory: [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          nullness: 0.3,
          trigger: 'system_recalculation'
        }
      ],
      relatedEvidence: ['evidence-1'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      metadata: {}
    };

    const validEmpathyProfile: EmpathyProfile = {
      id: 'profile-1',
      name: 'Test Profile',
      stakeholders: {
        patients: 0.8
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      isActive: true,
      metadata: {}
    };

    describe('Evidence Serialization', () => {
      it('should serialize valid Evidence to JSON', () => {
        const json = serializeEvidence(validEvidence);
        expect(typeof json).toBe('string');
        expect(JSON.parse(json)).toEqual(validEvidence);
      });

      it('should deserialize JSON to Evidence object', () => {
        const json = JSON.stringify(validEvidence);
        const result = deserializeEvidence(json);
        expect(result).toEqual(validEvidence);
      });

      it('should throw error when serializing invalid Evidence', () => {
        const invalidEvidence = { id: 'test' } as Evidence;
        expect(() => serializeEvidence(invalidEvidence)).toThrow('Cannot serialize invalid Evidence');
      });

      it('should throw error when deserializing invalid JSON', () => {
        const invalidJson = '{"id": "test"}';
        expect(() => deserializeEvidence(invalidJson)).toThrow('Failed to deserialize Evidence');
      });

      it('should throw error when deserializing malformed JSON', () => {
        const malformedJson = '{"id": "test"';
        expect(() => deserializeEvidence(malformedJson)).toThrow('Failed to deserialize Evidence');
      });
    });

    describe('Concept Serialization', () => {
      it('should serialize valid Concept to JSON', () => {
        const json = serializeConcept(validConcept);
        expect(typeof json).toBe('string');
        expect(JSON.parse(json)).toEqual(validConcept);
      });

      it('should deserialize JSON to Concept object', () => {
        const json = JSON.stringify(validConcept);
        const result = deserializeConcept(json);
        expect(result).toEqual(validConcept);
      });

      it('should throw error when serializing invalid Concept', () => {
        const invalidConcept = { id: 'test' } as Concept;
        expect(() => serializeConcept(invalidConcept)).toThrow('Cannot serialize invalid Concept');
      });

      it('should throw error when deserializing invalid JSON', () => {
        const invalidJson = '{"id": "test"}';
        expect(() => deserializeConcept(invalidJson)).toThrow('Failed to deserialize Concept');
      });
    });

    describe('EmpathyProfile Serialization', () => {
      it('should serialize valid EmpathyProfile to JSON', () => {
        const json = serializeEmpathyProfile(validEmpathyProfile);
        expect(typeof json).toBe('string');
        expect(JSON.parse(json)).toEqual(validEmpathyProfile);
      });

      it('should deserialize JSON to EmpathyProfile object', () => {
        const json = JSON.stringify(validEmpathyProfile);
        const result = deserializeEmpathyProfile(json);
        expect(result).toEqual(validEmpathyProfile);
      });

      it('should throw error when serializing invalid EmpathyProfile', () => {
        const invalidProfile = { id: 'test' } as EmpathyProfile;
        expect(() => serializeEmpathyProfile(invalidProfile)).toThrow('Cannot serialize invalid EmpathyProfile');
      });

      it('should throw error when deserializing invalid JSON', () => {
        const invalidJson = '{"id": "test"}';
        expect(() => deserializeEmpathyProfile(invalidJson)).toThrow('Failed to deserialize EmpathyProfile');
      });
    });
  });

  describe('Round-trip Serialization', () => {
    it('should maintain Evidence object integrity through serialization round-trip', () => {
      const original: Evidence = {
        id: 'evidence-round-trip',
        content: 'Round-trip test content',
        score: 0.85,
        cosineScore: 0.75,
        nullness: 0.15,
        empathyFit: 0.95,
        source: 'round-trip-source',
        metadata: {
          createdAt: '2024-01-01T12:00:00.000Z',
          tags: ['round-trip', 'test'],
          custom: 'value'
        }
      };

      const json = serializeEvidence(original);
      const deserialized = deserializeEvidence(json);
      expect(deserialized).toEqual(original);
    });

    it('should maintain Concept object integrity through serialization round-trip', () => {
      const original: Concept = {
        id: 'concept-round-trip',
        name: 'Round-trip Concept',
        currentNullness: 0.25,
        nullnessHistory: [
          {
            timestamp: '2024-01-01T12:00:00.000Z',
            nullness: 0.5,
            trigger: 'system_recalculation',
            context: 'Initial creation'
          },
          {
            timestamp: '2024-01-02T12:00:00.000Z',
            nullness: 0.25,
            trigger: 'evidence_added',
            context: 'Updated with new evidence'
          }
        ],
        relatedEvidence: ['evidence-1', 'evidence-2', 'evidence-3'],
        createdAt: '2024-01-01T12:00:00.000Z',
        updatedAt: '2024-01-02T12:00:00.000Z',
        metadata: {
          tags: ['round-trip', 'concept'],
          version: '2.0'
        }
      };

      const json = serializeConcept(original);
      const deserialized = deserializeConcept(json);
      expect(deserialized).toEqual(original);
    });

    it('should maintain EmpathyProfile object integrity through serialization round-trip', () => {
      const original: EmpathyProfile = {
        id: 'profile-round-trip',
        name: 'Round-trip Profile',
        description: 'Testing round-trip serialization for empathy profiles',
        stakeholders: {
          patients: 0.9,
          doctors: 0.7,
          nurses: 0.8,
          administrators: 0.3,
          researchers: 0.6,
          family_members: 0.75
        },
        createdAt: '2024-01-01T12:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
        isActive: true,
        metadata: {
          version: '1.2.0',
          tags: ['round-trip', 'healthcare', 'comprehensive'],
          author: 'test-user'
        }
      };

      const json = serializeEmpathyProfile(original);
      const deserialized = deserializeEmpathyProfile(json);
      expect(deserialized).toEqual(original);
    });
  });
});
