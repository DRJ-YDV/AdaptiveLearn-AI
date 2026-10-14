# Evaluation status and reporting guide

This file records what the prototype can measure and distinguishes implemented evaluation tooling from results that still require a real run. Do not report uncollected numbers as measured outcomes.

## Available evaluation paths

- **Deterministic regression suite:** exercises fixed retrieval and tutor fixtures for repeatable local checks.
- **Uploaded PDF benchmark:** Gemini drafts answerable questions with reference answers and evidence-page ids. Review each draft against the PDF and approve it before scoring.
- **RAGAS export:** exports approved question/reference/answer/context records for Faithfulness, Answer Relevancy, Context Precision, and Context Recall. See [Course Material Evaluation](COURSE_MATERIAL_EVALUATION.md).
- **Extraction review:** a review template supports human labels for concept tags, prerequisite links, page-text presence, and visual descriptions.
- **Learner simulation:** repeated quiz sessions estimate mastery changes for simulated learner profiles; this is not a study of real learners.

## Result reporting

No benchmark scores are asserted in this document. Run the evaluation against the intended course material, approve the gold evidence labels, save the generated report, and record:

1. App revision and model/provider configuration.
2. Course source names, page counts, and extraction status.
3. Number of candidate, reviewed, and approved benchmark cases.
4. Retrieval and answer metrics, with the number of cases used for each metric.
5. Extraction-review precision/recall results and reviewer identity where applicable.
6. Known failures, unavailable model calls, and excluded cases.

Generated questions and model-judge scores are estimates until checked against source material. Human review and evaluation on real learners remain necessary before making claims about learning outcomes.
