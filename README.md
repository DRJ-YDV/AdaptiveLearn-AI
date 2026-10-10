# AdaptiveLearn AI

AdaptiveLearn AI is a course-grounded study companion for the 2026 Multimodal AI Hackathon, Track D. It indexes PDFs, PowerPoint decks, video lectures, and text; provides a source-grounded tutor and revision kits; generates adaptive assessments; and tracks per-concept learner state.

## Start the app

1. Install Node.js and run `npm install`.
2. Set `GEMINI_API_KEY` in a root `.env` file. `GEMINI_MODEL` and `GEMINI_EMBEDDING_MODEL` can be overridden there.
3. Run `npm run dev`. Vite serves the web app at `http://localhost:5173`; Express serves the Gemini proxy and local data API at port `3001`.

The checked-in `.env.example` shows the provider settings. Do not commit a real API key.

## Learning flow

1. **Add course sources.** In My Courses, upload PDF, PPTX, MP4, WebM, MOV, TXT, or Markdown files. PDF pages are rendered and analyzed by Gemini; PPTX text and embedded raster images are extracted slide by slide; video is transcribed and analyzed in five-minute source windows. Empty and unsupported files fail visibly instead of becoming fake course material.
2. **Inspect the knowledge map.** Extracted headings and concepts are linked to pages, slides, or timestamps. Prerequisite links are created only when extraction identifies a supported relation. Map state is stored in browser local storage and can be rebuilt from indexed chunks.
3. **Study with the tutor.** Retrieval is course-filtered. Answers use retrieved excerpts, unsupported requests are declined, and each citation carries the original source id and location. Uploaded originals are stored under `server/data/sources`; PDF citations open at the cited page, and video citations can seek to the cited timestamp.
4. **Assess and adapt.** Choose the full course or a topic and a quiz length. Gemini generates MCQ, short-answer, and numerical questions when the source supports them. The server checks the question schema, answer key, evidence reference, and answer-to-source overlap. MCQs can tag misconception-bearing distractors; short answers use required keywords, and numerical answers use a stated tolerance. Reused prompt text is excluded from later generated assessments in the same browser.
5. **Review progress.** Quiz attempts update per-concept mastery, confidence, trends, and detected misconceptions. Overview recommendations use those learner signals; the Tutor receives mastery and misconception context. A diagnostic initializes a first-time learner without applying normal practice feedback.
6. **Plan study time.** The Study Plan dashboard schedules course concepts around an exam date, available study days, and minutes per day. It prioritizes weaker concepts and prerequisites, and lets learners track completed sessions. It does not send reminders or sync to an external calendar.
7. **Create revision materials.** The Revision Kit dashboard turns a selected indexed source into structured study notes, key points, and flashcards with source locations. Kits are saved in the browser and can be downloaded as Markdown. Review generated notes against the source before relying on them.
8. **Choose a tutor language.** The Tutor supports English, Hindi, and Hindi-English Hinglish response instructions when Gemini mode is enabled. Browser speech recognition and read-aloud use the selected language, subject to browser and voice support.
9. **Run the benchmark.** Every newly uploaded PDF gets a draft benchmark generated from its indexed pages when Gemini is configured. Review and approve candidates in the Evaluation page before scoring them. The page reports exact gold-page retrieval metrics, optional Gemini-as-a-judge scores, and labeled lexical proxies. Export approved cases for RAGAS evaluation. See [the course material evaluation workflow](docs/COURSE_MATERIAL_EVALUATION.md). Personalization remains simulated over five learner profiles and three sessions; this is not evidence of real learner improvement.

The Track D 3–10 minute demo requirement still needs an actual recording and YouTube publication. A timed walkthrough script is prepared in [`docs/DEMO_VIDEO_SCRIPT.md`](docs/DEMO_VIDEO_SCRIPT.md).

Assessment generation makes a second AI verification pass against the cited course excerpt before a generated question is accepted. `GEMINI_VERIFIER_MODEL` can be set separately from `GEMINI_MODEL` to use a different verifier model. Near-duplicate question prompts are screened against saved prompts with a conservative lexical similarity check; semantic duplication still needs human review.

Grounded tutor replies offer an optional learner self-report (“I understand” / “I need more help”). The learner model applies a small, explicit mastery and confidence adjustment from that signal; it does not treat an unanswered question as proof of understanding.

## Architecture

```text
React / TypeScript UI
  -> multimodal extraction (PDF.js, PPTX/ZIP, Gemini video)
  -> source-linked content units and chunks
  -> Gemini embeddings -> local file-backed vector store
  -> course-filtered retrieval -> Gemini grounded tutor
  -> adaptive assessment -> local learner state
  -> mastery, misconception, progress, and next-action views
```

**Grounding:** Page/slide/timestamp metadata is attached to chunks before indexing. The model receives only the retrieved excerpts and must return either a supported answer or an unsupported result. Citation labels are created from chunk metadata; the model cannot invent page numbers. Local uploaded files are served by the Express API for source review.

**Learner model:** Mastery and confidence use deterministic incremental heuristics rather than Bayesian Knowledge Tracing. For a correct response, mastery increases by `0.05 + 0.1 × difficulty`; for an incorrect response it decreases by `0.05 + 0.1 × (1 - difficulty)`, clamped to 0–1. Confidence rises by 0.1 after correct answers and falls by 0.15 after incorrect answers. Diagnostic answers initialize a baseline. Misconception-tagged distractors create or increment misconception records. Learner state is kept in browser local storage; vectors and source files are kept on the local server.

## Evaluation honesty

The demo benchmark uses deterministic fixtures. Each uploaded-PDF benchmark begins as a Gemini-generated draft and should be checked against the source pages before its scores are reported. The Evaluation page exports approved cases for RAGAS Faithfulness, Answer Relevancy, Context Precision, and Context Recall. Gemini judge scores remain model estimates. Mastery gain is simulated, not a result from human learners. See [the course material evaluation workflow](docs/COURSE_MATERIAL_EVALUATION.md) for metric provenance and remaining validation work.

## Current boundaries

- The interface currently uses one configured course id (`course_ml_101`); it does not yet provide course creation, account management, or multi-user sign-in.
- Mastery changes on assessment answers. A tutor conversation provides learner context, but does not by itself change mastery because a learner question is not evidence of a correct answer.
- Short-answer grading is a keyword rubric, not semantic human grading. Numerical items are generated only when material supports a solvable numeric task; generation may return fewer items than requested.
- Prompt-text novelty is tracked locally. It reduces exact repeats, but does not prove semantic novelty across browsers.
- PDF originals open at a page. Video originals play and seek locally. PPTX citations identify the slide and excerpt; opening the original deck may download it because browsers do not render slide decks natively.
- The built-in evaluation suite is a local benchmark and regression harness; the separate RAGAS runner provides framework-based RAG metrics. Revision kits are Gemini-generated drafts and should be reviewed against their cited material. Hindi and Hinglish answer generation requires `VITE_LLM_PROVIDER=gemini`; the deterministic mock tutor answers in English. Browser voice support varies by browser. The demo video still needs to be recorded and published.
- Source files, vectors, and learner state are local to this machine/browser. Back up `server/data` and the relevant browser profile before moving the demo to another computer.
