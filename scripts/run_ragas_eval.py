"""Run RAGAS 0.4 metrics over a dataset exported from the Evaluation page.

Usage: python scripts/run_ragas_eval.py <computer-graphics-ragas-dataset.json>
Requires GEMINI_API_KEY in the environment (or a root .env file).
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from ragas.embeddings import GoogleEmbeddings
from ragas.llms import llm_factory
from ragas.metrics.collections import AnswerRelevancy, ContextPrecision, ContextRecall, Faithfulness


async def main() -> None:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise SystemExit("Set GEMINI_API_KEY or GOOGLE_API_KEY before running RAGAS.")
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/run_ragas_eval.py <ragas-dataset.json>")

    dataset_path = Path(sys.argv[1])
    records = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not records:
        raise SystemExit("Input must be a non-empty JSON list exported by the Evaluation page.")
    records = [row for row in records if row.get("reference") and row.get("response") and row.get("retrieved_contexts")]
    if not records:
        raise SystemExit("No supported cases with reference answers and retrieved contexts were found.")

    client = genai.Client(api_key=api_key)
    model = os.getenv("RAGAS_GEMINI_MODEL", "gemini-2.5-flash")
    llm = llm_factory(model, provider="google", client=client)
    embeddings = GoogleEmbeddings(client=client, model="gemini-embedding-001")
    metrics = {
        "faithfulness": (Faithfulness(llm=llm), ("user_input", "response", "retrieved_contexts")),
        "answer_relevancy": (AnswerRelevancy(llm=llm, embeddings=embeddings), ("user_input", "response")),
        "context_precision": (ContextPrecision(llm=llm), ("user_input", "reference", "retrieved_contexts")),
        "context_recall": (ContextRecall(llm=llm), ("user_input", "reference", "retrieved_contexts")),
    }

    output_rows = []
    for index, row in enumerate(records, start=1):
        scored = dict(row)
        for name, (metric, fields) in metrics.items():
            values = {
                "user_input": row["question"],
                "response": row["response"],
                "retrieved_contexts": row["retrieved_contexts"],
                "reference": row["reference"],
            }
            kwargs = {field: values[field] for field in fields}
            result = await metric.ascore(**kwargs)
            scored[name] = result.value
        output_rows.append(scored)
        print(f"Scored {index}/{len(records)}")

    summary = {
        "framework": "RAGAS",
        "frameworkVersion": "0.4.x (collections API)",
        "model": model,
        "sampleSize": len(output_rows),
        "metrics": {
            name: sum(row[name] for row in output_rows) / len(output_rows)
            for name in metrics
        },
        "cases": output_rows,
    }
    output_path = dataset_path.with_name(f"{dataset_path.stem}-ragas-results.json")
    output_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {output_path}")
    print(json.dumps(summary["metrics"], indent=2))


if __name__ == "__main__":
    asyncio.run(main())
