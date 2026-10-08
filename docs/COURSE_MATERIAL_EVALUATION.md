# Course material evaluation workflow

Every newly uploaded PDF receives a draft evaluation benchmark after its indexed pages are available. Gemini generates candidate answerable questions, reference answers, and evidence-page IDs, then a second model pass checks them against those passages. Drafts are stored locally in the browser, appear on the Evaluation page, and stay out of scored metrics until you review and approve them. They are still not an independent gold set; review them against the original PDF before relying on results.

## Run a PDF benchmark

1. Start the app and backend, configure Gemini, upload a PDF, and wait for indexing and question generation to finish.
2. Open **Evaluation**, select the PDF, inspect each generated question, reference answer, and evidence page. Edit questionable text, approve only sound cases, and add unsupported-query checks where appropriate.
3. Run the evaluation. N/A means no approved supported questions, no indexed source, or the optional judge is not configured.
4. Download **Export RAGAS dataset** to save each approved question, reference answer, system response, and retrieved contexts.
5. Install `requirements-evaluation.txt` in a Python environment and run:

   ```powershell
   python -m pip install -r requirements-evaluation.txt
   python scripts/run_ragas_eval.py computer-graphics-ragas-dataset.json
   ```

   Ensure `GEMINI_API_KEY` is set in the environment or root `.env`, and set `VITE_LLM_PROVIDER=gemini` before starting the frontend so the exported answers come from Gemini rather than the deterministic mock provider. The script writes per-case and mean RAGAS Faithfulness, Answer Relevancy, Context Precision, and Context Recall to a results JSON file.

## Review extraction labels

1. Download **Download extraction review template** from the Evaluation page.
2. Compare every listed page with the original PDF and fill in expected concept labels, prerequisite edges, whether text and visual descriptions should be present, and whether each extracted visual description is accurate. Do not copy extracted values into expected fields without checking the page. If the app indexed this PDF before concept tags were saved with chunks, upload and index it again first, then download a fresh template.
3. Set `reviewStatus` to `HUMAN_REVIEWED` and enter a reviewer label in `reviewedBy`.
4. Import the completed JSON and rerun evaluation. The report computes concept and prerequisite precision/recall/F1, page text presence accuracy, visual-description coverage agreement, and visual-description approval rate over reviewer labels.

Generated benchmark labels are model drafts until a reviewer checks and approves them; the second model pass is not independent ground truth. The workflow also does not measure learner improvement on real students or question difficulty calibration. Those require real response data and a learner study. The mastery simulation is reported separately from real learner evidence.
