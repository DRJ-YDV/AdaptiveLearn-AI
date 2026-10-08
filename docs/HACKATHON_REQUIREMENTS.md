# Track D requirement coverage

This checklist compares the current prototype with the supplied Multimodal AI Hackathon 2026 Track D brief. “Implemented” means the feature is present in the app; it does not imply independent human validation.

## Core requirements

| Requirement | Status | What the prototype does / remaining gap |
| --- | --- | --- |
| Ingest lecture video, textbooks, and slide decks | Implemented | PDF, PPTX, and common video types use Gemini-backed extraction; TXT/Markdown are parsed locally. PDFs are processed page by page; PPTX embedded raster images are sent for visual analysis; videos are analyzed in timed segments. |
| Topics, concepts, prerequisite links, and source locations | Partial | PDF/video extraction returns source-grounded concepts and relations; PPTX slides now receive a text-and-visual structure pass. Relations are linked only when supported by source content. Cross-document concept merging and extraction quality still need measured validation. |
| Tag every unit to concepts | Partial | Ingested units carry extracted concept tags, including a text-structure pass for PPTX. Fallback tags exist when extraction is sparse, but tag relevance and coverage still depend on model quality and require a labeled extraction benchmark. |
| Extract figures, diagrams, and images | Implemented | PDF pages are analyzed as images; supported embedded raster images in PPTX slides and video visuals are analyzed. Unsupported vector formats may be skipped. |
| Grounded answers with excerpts and source citations | Implemented | Tutor uses course-filtered retrieval and displays excerpts with source ids and locations. PDFs open at the referenced page; videos can seek to the cited timestamp. A PPTX citation identifies the exact slide/excerpt, while opening the deck may download it. |
| Decline unsupported questions | Implemented | Empty retrieval and unsupported Gemini answers are visibly flagged. This still needs larger adversarial and human review before claiming high assurance. |
| Scoped adaptive quizzes with MCQ, short answer, and numerical questions | Partial | Learners can select course or topic scope. Gemini generates supported question types, and the UI grades MCQ, keyword-based short answers, and numeric answers with tolerance. The model may return fewer questions where sources do not support the requested count or type. |
| Verify answer keys and prevent repeats | Partial | A second AI verification pass checks generated keys and explanations against selected evidence before schema/source checks. Set `GEMINI_VERIFIER_MODEL` separately for a different verifier model. Near-duplicate prompt pairs are filtered by lexical similarity against saved prompts; semantic novelty and verifier accuracy still need human evaluation. |
| Cited feedback, weak-topic report, misconception signals | Partial | Feedback includes the supporting source. Assessment results identify weak concepts. MCQ distractors can attach misconception ids, but free-response grading does not yet diagnose misconceptions robustly. |
| Update per-topic mastery after quizzes and conversations | Partial | Quiz answers update mastery/confidence by concept. Grounded tutor replies now ask for explicit “understood / need more help” self-report and apply a small mastery/confidence adjustment, recorded as a conversation signal. Self-report is weak evidence and does not replace a comprehension check. |
| New-learner diagnostic | Implemented | A diagnostic quiz initializes mastery/confidence and records completion. There is no separate intake conversation yet. |
| Standard evaluation framework and faithfulness/relevancy/context metrics | Partial | Every newly uploaded PDF can produce a Gemini-generated draft benchmark with evidence page IDs and a separate verification pass. Learners/reviewers must inspect and approve candidate questions before those cases are scored. Approved cases can be exported for external RAGAS 0.4 metrics. |
| Extraction and assessment quality evidence | Partial | A per-PDF review-template workflow can calculate concept precision/recall/F1, prerequisite relation precision/recall/F1, page text presence accuracy, and figure-description coverage against reviewer-entered labels. Labeled grader probes cover known edge cases; real human-graded answers and difficulty calibration still need a learner pilot. |

## Optional features and deliverables

- **Visual course map:** Present; prerequisite edges appear when supported relations are extracted.
- **Revision materials, study schedule, mixed-language and audio tutoring:** Not implemented.
- **Project documentation:** Architecture, grounding, learner-model method, setup, and evaluation boundaries are in the root README.
- **Demonstration video:** A timed recording script is prepared at `docs/DEMO_VIDEO_SCRIPT.md`; the video still needs to be recorded and published on YouTube.

## Local verification

- `npm run build` — passes after the latest changes; Vite still reports a large JavaScript bundle warning.
- Each newly uploaded PDF receives a draft question benchmark when Gemini is configured. Candidates are stored locally, shown on the Evaluation page, and excluded from metrics until approved. See `docs/COURSE_MATERIAL_EVALUATION.md` for reviewing labels and running RAGAS.
- Run with Gemini configured to populate LLM-judge metrics; metrics are not a substitute for human review.
- The external demonstration video has not been recorded or published.
