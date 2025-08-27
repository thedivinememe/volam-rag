# VOLaM-RAG

Evidence ranking with nullness tracking and empathy profiling.

## Overview

VOLaM-RAG implements a novel evidence ranking algorithm that combines:
- **VOLaM Score**: `α·cosine + β·(1−nullness) + γ·empathy_fit`
- **Nullness tracking**: Dynamic uncertainty measurement that evolves over time
- **Empathy profiling**: Stakeholder-weighted evidence relevance

## Architecture

```
/api          - TypeScript/Node backend (Fastify)
/ui           - React frontend (Vite)
/scripts      - Automation and evaluation scripts
/data         - Storage layer (corpus, embeddings, nullness, profiles)
/reports      - Evaluation results and metrics
/docs         - Documentation
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install all dependencies
make setup

# Seed the corpus and generate embeddings
make seed

# Start the API server (port 8000)
make api

# Start the UI development server (port 3000)
make ui
```

### Available Commands

```bash
make setup        # Install dependencies for all components
make seed         # Chunk documents and generate embeddings
make api          # Start the backend API server
make ui           # Start the frontend development server
make eval-baseline # Run baseline cosine-only evaluation
make eval-volam   # Run VOLaM algorithm evaluation
make clean        # Clean build artifacts and node_modules
```

## API Endpoints

### Ranking
- `GET /api/rank?mode=baseline&query=<query>&k=5`
- `GET /api/rank?mode=volam&query=<query>&k=5&alpha=0.6&beta=0.3&gamma=0.1`

### Health Check
- `GET /health`

### Documentation
- `GET /docs` - Swagger UI

## Core Features

### Evidence Ranking Modes

**Baseline Mode**: Traditional cosine similarity ranking
```
score = cosine_similarity(query_embedding, evidence_embedding)
```

**VOLaM Mode**: Multi-factor ranking with nullness and empathy
```
score = α·cosine + β·(1−nullness) + γ·empathy_fit
```

### Nullness Tracking
- Tracks uncertainty (nullness) per concept over time
- Calculates ΔNullness to show confidence evolution
- Persists history for evaluation and analysis

### Empathy Profiling
- Stakeholder-weighted evidence relevance
- Configurable profiles for different use cases
- Considers impact on affected communities

## Evaluation

The system includes comprehensive evaluation against baseline:
- **Accuracy**: +10% absolute improvement target
- **Calibration**: Brier score and ECE reduction ≥15%
- **Nullness Evolution**: Track ΔNullness over time

## Development

### Project Structure
```
api/
├── src/
│   ├── routes/     # API route handlers
│   ├── services/   # Business logic (ranking, nullness)
│   ├── models/     # Data models and types
│   └── utils/      # Utility functions
└── tests/          # API tests

ui/
├── src/
│   ├── components/ # React components
│   ├── pages/      # Page components
│   └── utils/      # Frontend utilities
└── public/         # Static assets

scripts/
├── seed.ts         # Data seeding
├── eval-baseline.ts # Baseline evaluation
└── eval-volam.ts   # VOLaM evaluation
```

### Tech Stack
- **Backend**: TypeScript, Fastify, FAISS/SQLite/Chroma
- **Frontend**: React, Vite, TailwindCSS, Recharts
- **Testing**: Vitest, Coverage reporting
- **Linting**: ESLint, Prettier

## Contributing

1. Follow the .clinerules guidelines
2. Keep diffs small (<300 lines per PR)
3. Include tests for new features
4. Run evaluation scripts before submitting

## License

MIT
