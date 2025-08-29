# VOLaM-RAG Makefile
# Canonical commands from .clinerules

.PHONY: setup seed api ui eval-baseline eval-baseline-seed eval-volam eval-volam-seed plots-calibration validate-qa clean help

# Default target
help:
	@echo "VOLaM-RAG Project Commands:"
	@echo "  make setup            - Install dependencies for all components"
	@echo "  make seed             - Chunk documents and generate embeddings"
	@echo "  make api              - Start the backend API server"
	@echo "  make ui               - Start the frontend development server"
	@echo "  make eval-baseline    - Run baseline cosine-only evaluation"
	@echo "  make eval-baseline-seed - Run baseline evaluation with seed=42"
	@echo "  make eval-volam       - Run VOLaM algorithm evaluation"
	@echo "  make eval-volam-seed  - Run VOLaM evaluation with seed=42"
	@echo "  make plots-calibration - Generate calibration plots"
	@echo "  make validate-qa      - Validate Q/A dataset against schema"
	@echo "  make clean            - Clean build artifacts and node_modules"

# Install dependencies for all components
setup:
	@echo "Installing API dependencies..."
	cd api && npm install
	@echo "Installing UI dependencies..."
	cd ui && npm install
	@echo "Installing script dependencies..."
	npm install
	@echo "Setup complete!"

# Chunk documents and generate embeddings
seed:
	@echo "Seeding corpus and generating embeddings..."
	npm run seed

# Start the backend API server
api:
	@echo "Starting API server..."
	cd api && npm run dev

# Start the frontend development server
ui:
	@echo "Starting UI development server..."
	cd ui && npm run dev

# Run baseline cosine-only evaluation
eval-baseline:
	@echo "Running baseline evaluation..."
	npm run eval:baseline

# Run baseline evaluation with deterministic seed
eval-baseline-seed:
	@echo "Running baseline evaluation with seed=42..."
	npm run eval:baseline:seed

# Run VOLaM algorithm evaluation
eval-volam:
	@echo "Running VOLaM evaluation..."
	npm run eval:volam

# Run VOLaM evaluation with deterministic seed
eval-volam-seed:
	@echo "Running VOLaM evaluation with seed=42..."
	npm run eval:volam:seed

# Generate calibration plots
plots-calibration:
	@echo "Generating calibration plots..."
	npm run plots:calibration

# Validate Q/A dataset against schema
validate-qa:
	@echo "Validating Q/A dataset..."
	npm run validate:qa

# Clean build artifacts and dependencies
clean:
	@echo "Cleaning build artifacts..."
	rm -rf api/node_modules api/dist
	rm -rf ui/node_modules ui/dist ui/build
	rm -rf node_modules
	rm -rf reports/*
	@echo "Clean complete!"
