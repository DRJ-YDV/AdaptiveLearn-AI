# AdaptiveLearn AI

**AdaptiveLearn AI is a multimodal, course-grounded learning workspace that turns study materials into a connected path from understanding to practice.** Bring in lecture videos, PDFs, slide decks, and text; then explore concepts, ask questions with source evidence, take adaptive assessments, plan study sessions, and create revision materials in one place.

Built for the **2026 Multimodal AI Hackathon — Track D**.

## What it does

- **Indexes course material:** Import lecture videos (`.mp4`, `.mov`, `.webm`), PDFs, PowerPoint decks (`.pptx`), text (`.txt`), and Markdown (`.md`). Video lectures are analyzed in five-minute windows to extract speech transcripts, important on-screen content, and concepts. PDF pages and PowerPoint slides are analyzed with their text and supported visual content. Indexed passages retain page, slide, section, or video time-range locations.
- **Maps course knowledge:** Explore uploaded sources, topics, concepts, and prerequisite relationships in a knowledge map. Relationships appear when supported by extracted material.
- **Answers with evidence:** Ask the AI Tutor questions across the course or about a selected source, including a specific lecture. Responses include excerpts and source locations; video evidence includes timestamps that help you return to the relevant moment. Unsupported questions are identified instead of answered as fact. Gemini mode supports English, Hindi, and Hinglish.
- **Adapts assessment:** Start with a diagnostic or practice by course, topic, or source. Supported question types include multiple choice, short answer, and numerical problems. Generated questions are checked against their evidence, and learner responses update concept-level progress.
- **Tracks learning:** Review mastery, confidence, misconceptions, recent answers, and recommended next actions across Overview and Learning Progress.
- **Plans study time:** Build a schedule around an exam date, available weekdays, and a daily time budget. The plan prioritizes prerequisites and concepts with lower mastery, and tracks completed sessions.
- **Creates revision materials:** Generate source-specific summaries, key points, and flashcards from indexed course content, including lectures, with evidence locations. Revision Kits can be downloaded as Markdown.
- **Evaluates quality:** Run a regression suite, review PDF benchmark drafts, inspect extraction labels, and export approved cases for RAGAS metrics.

## How the learning flow works

```mermaid
flowchart LR
    A[Video lectures, PDFs, slides, text, Markdown] --> B[Extract content and source locations]
    B --> C[Concepts and knowledge map]
    B --> D[Chunk and embed]
    D --> E[Local vector index]
    E --> F[Course- or source-scoped retrieval]
    F --> G[Evidence-grounded tutor]
    F --> H[Assessment generation and verification]
    H --> I[Grading and learner model]
    I --> J[Progress and next action]
    I --> K[Study Plan]
    B --> L[Revision Kit]
    G --> M[Evaluation]
    H --> M
```

## Architecture

```text
React + TypeScript client (Vite)
  ├─ PDF.js and JSZip parsing; Gemini video, visual, and topic extraction
  ├─ Gemini-backed embeddings, tutor, and assessment
  ├─ Browser localStorage: learner state, map data, plans, revision kits
  └─ Express API (port 3001)
       ├─ Gemini API proxy
       ├─ server/data/vectors.json: local vector index
       └─ server/data/sources/: uploaded source files
```

The client extracts source content and keeps its page, slide, section, or timestamp metadata as it is indexed. Video files are sent through the Express API to Gemini and analyzed in five-minute windows; speech transcripts and descriptions of relevant visuals are indexed with their time ranges. The configured Gemini embedding model creates vectors. The Express service persists vectors and uploaded source files locally. Retrieval can be limited to the course or selected sources. Tutor evidence references are built from retrieved chunk metadata, so source labels and locations come from indexed material.

The learner model uses deterministic mastery and confidence updates rather than Bayesian Knowledge Tracing. Assessment grading uses answer keys for multiple choice, required keywords for short answers, and a configured tolerance for numerical responses.

## Getting started

### Requirements

- A recent Node.js LTS release and npm
- A Gemini API key for Gemini-backed features

### Install and configure

```bash
npm install
```

Copy `.env.example` to `.env`, then add your Gemini API key. On PowerShell, use `Copy-Item .env.example .env`.

```dotenv
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_VERIFIER_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
VITE_LLM_PROVIDER=gemini
VITE_EMBEDDING_PROVIDER=gemini
VITE_VECTOR_STORE=persistent
PORT=3001
```

Keep the real API key in `.env`; never commit it.

### Run locally

```bash
npm run dev
```

This starts the Vite client at `http://localhost:5173` and the Express API at `http://localhost:3001`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the client and API for local development |
| `npm run build` | Type-check and create a production client build |
| `npm run preview` | Preview the built client |
| `npm run lint` | Run Oxlint |

## Evaluation and review

The Evaluation page combines deterministic regression checks with course-material benchmarks. A PDF benchmark can be drafted from indexed pages, but its questions and evidence labels must be reviewed and approved before scoring. Retrieval metrics use labeled evidence. Optional Gemini judge scores are estimates and are reported separately. Extraction-review labels can measure concept and prerequisite extraction, and approved benchmark cases can be exported for RAGAS Faithfulness, Answer Relevancy, Context Precision, and Context Recall.

The built-in learner simulations are test scenarios, not real learner studies. Their results should not be presented as proof of learning gains.

## Current boundaries

- The app currently uses one configured course and has no account system or multi-user sign-in.
- Source files and vectors are stored locally by the API. Learner state, plans, map data, and revision kits are stored in the browser. Data does not sync across devices.
- Short-answer grading uses keyword rules, not semantic human grading. Numerical questions are generated only when the source supports a solvable task.
- Mastery updates use deterministic heuristics. Learner self-report is a small signal, not proof of understanding.
- Extracted concept links and generated revision content can contain errors; review them against the original source.
- Gemini-backed features require a valid API key and provider configuration.

## Project documentation

- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Course-material evaluation workflow](docs/COURSE_MATERIAL_EVALUATION.md)
- [Evaluation results and limitations](docs/EVALUATION_RESULTS.md)
- [Hackathon requirement coverage](docs/HACKATHON_REQUIREMENTS.md)
