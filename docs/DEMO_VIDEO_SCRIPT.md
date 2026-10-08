# Track D demonstration video script (about 5 minutes)

Record the working app in one continuous walkthrough with readable browser text. The brief asks for a 3–10 minute YouTube video covering source upload, grounded chat, assessments, and technical architecture.

## 0:00–0:25 — Challenge and workflow

**Show:** Dashboard.

**Say:** “AdaptiveLearn brings a learner’s course materials into one source-grounded study workflow. I’ll upload source material, ask a question and inspect its evidence, take an adaptive quiz, then show how the system evaluates and updates learning.”

## 0:25–1:15 — Ingest sources

**Show:** My Courses. Upload the prepared course PDF and slide deck; if a short lecture video is available, upload the permitted local video file too. Wait for each ingestion result and show the extracted topics/concepts.

**Say:** “PDF pages, PowerPoint slides and supported video files are analyzed without manually chunking the content. The pipeline attaches each extracted unit to a page, slide or video time. Visual descriptions and concept/prerequisite tags are grounded in what the source actually shows.”

**Capture:** A successful ingestion state and the source locations visible in the knowledge map. Don’t imply every visual format or every extraction is perfect.

## 1:15–2:15 — Grounded tutoring

**Show:** Tutor. Ask one question clearly answered by the uploaded material, open the cited evidence, and show its location. Then ask one question not covered by the material and show the refusal/unsupported notice. If available, show the “I understand / I need more help” learner signal.

**Say:** “The tutor retrieves course passages, answers from those sources and links back to the supporting page, slide or timestamp. If the material doesn’t support an answer, the tutor says so. Learner feedback on an explanation is recorded as a small self-reported signal; quiz answers remain stronger evidence.”

## 2:15–3:20 — Adaptive assessment

**Show:** Select the uploaded topic and start a short quiz. Answer a question, inspect its cited feedback, use Previous question to revise an answer, then show the optional timer setup if useful.

**Say:** “Questions are limited to the learner’s selected topic and carry source evidence and difficulty. A second AI pass checks generated answer keys against the cited excerpt, then schema and grounding checks run before questions reach the learner. The quiz updates concept mastery, and the result report focuses on the latest assessment.”

## 3:20–4:05 — Learner model and map

**Show:** Knowledge Map and Progress or the assessment results page.

**Say:** “The learner model tracks concept-level mastery and confidence. Weak areas guide later practice and tutor explanations. The map links concepts and prerequisite relations when the source supports them.”

## 4:05–4:45 — Evaluation

**Show:** Evaluation page, run the benchmark if configured, and export or display the report.

**Say:** “The benchmark uses hand-labeled gold passage IDs for context precision and recall, a Gemini judge for answer faithfulness and relevance when configured, and simulated learner profiles over repeated assessment sessions. These are measured signals, not a substitute for human review.”

## 4:45–5:00 — Architecture and close

**Show:** A simple architecture slide: React/TypeScript UI → ingestion/extraction → chunking and vector retrieval → Gemini tutor/assessment → learner model → evaluation.

**Say:** “The prototype connects multimodal source extraction, retrieval-grounded tutoring, adaptive assessment and learner-state tracking in one course workflow.”

## Before recording

- Use synthetic or permitted course material and a clean demo learner profile.
- Confirm Gemini is configured and the backend is running.
- Wait for extraction and model calls to finish before moving between screens.
- Keep source citations and result text large enough to read in the recording.
- Publish the final 3–10 minute recording to YouTube; this script is preparation, not the required video itself.
