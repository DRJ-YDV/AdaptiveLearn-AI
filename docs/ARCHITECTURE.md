# AdaptiveLearn AI architecture

## Runtime components

```text
React + TypeScript client (Vite, port 5173)
  ├─ PDF.js / JSZip local source parsing
  ├─ Gemini multimodal extraction, tutoring, assessment, and embeddings
  ├─ Browser localStorage: learner state, map data, revision kits, draft benchmarks
  └─ Express API (port 3001)
       ├─ Google Gemini API proxy
       ├─ server/data/vectors.json: file-backed vector index
       └─ server/data/sources/: uploaded originals for citation links
```

## Ingestion and retrieval

Ingestion creates content units tied to a PDF page, slide, video timestamp, or text section. The semantic chunker preserves these locations as metadata. The configured Gemini embedding model turns chunk text into vectors, which the Express service stores locally. Tutor questions are embedded, searched against the selected course/source scope, and answered from retrieved excerpts. Citation labels and locations come from stored chunk metadata.

PDF, PPTX, and video extraction use the configured Gemini model where visual or multimodal understanding is needed. Text and Markdown are parsed locally. PPTX text is read from the package, and supported embedded images can be analyzed. Video extraction uploads the source to Gemini and requests time-bounded segments.

## Tutor and assessment

The tutor sends the user question, response-language preference, learner context, and retrieved course evidence to Gemini. Unsupported questions should be identified rather than answered as if grounded. Assessment generation requests evidence-linked questions, then validates structure and checks answer claims against selected source passages before presenting them. Mastery, confidence, misconception records, and study-plan state use browser-local learner data.

## Study plan

The Study Plan page loads the course topics and concepts from `courseRepository` and the learner's current mastery model from `learnerModelService`. The learner chooses an exam date, a daily time budget (30–480 minutes), and available weekdays. The page rejects past exam dates and plans with no selected study days.

`studyPlanService.build` orders concepts so available prerequisites are scheduled before their dependents. Among concepts that are ready to schedule, lower mastery scores come first; concepts without a saved score use a default mastery of 0.5. Each concept receives one estimated session: 25 minutes below 40% mastery, 20 minutes below 70%, and 12 minutes otherwise. Sessions are packed into the chosen days without exceeding the daily budget. The date scan is capped at 180 eligible days; concepts that do not fit are returned as unscheduled and shown to the learner. The session reason labels describe reinforcement, mastery building, or review priority; they do not generate additional spaced repetitions.

Generated plans, completion state, and settings are stored in browser `localStorage` under the user/course-specific Study Plan key. Learners can edit and regenerate the plan, mark sessions complete, and open a scheduled concept in the tutor or a topic in practice. This state is local to the browser and does not sync across devices.

## Configuration

- `GEMINI_API_KEY`: required by the backend for Gemini-backed features.
- `GEMINI_MODEL`: generation and multimodal extraction model.
- `GEMINI_EMBEDDING_MODEL`: vector embedding model.
- `GEMINI_VERIFIER_MODEL`: optional assessment verification model.
- `VITE_LLM_PROVIDER=gemini`: enable Gemini-backed tutor mode in the client.

Use `.env.example` for local setup and keep real credentials out of source control. The vector store and uploaded originals are local prototype storage, not a managed production database. Browser-local learner state does not sync across devices.
