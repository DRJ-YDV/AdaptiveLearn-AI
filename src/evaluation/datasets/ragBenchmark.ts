import { EvaluationCase } from '../types';

export const ragBenchmarkDataset: EvaluationCase[] = [
  {
    id: "rag-001",
    question: "What is gradient descent?",
    type: "SUPPORTED",
    expectedConceptId: "con_gradient_descent",
    expectedSourceIds: ["src_1"], expectedChunkIds: ["chunk_1"],
    referenceAnswer: "Gradient descent minimizes an objective by repeatedly moving parameters in the direction opposite the gradient."
  },
  {
    id: "rag-002",
    question: "How is information gain calculated?",
    type: "SUPPORTED",
    expectedConceptId: "con_infogain",
    expectedSourceIds: ["src_3"], expectedChunkIds: ["chunk_3"],
    referenceAnswer: "Information gain is the parent entropy minus the weighted average entropy of the child nodes; it measures the reduction in uncertainty."
  },
  {
    id: "rag-003",
    question: "What is entropy?",
    type: "SUPPORTED",
    expectedConceptId: "con_entropy",
    expectedSourceIds: ["src_1"], expectedChunkIds: ["chunk_2"],
    referenceAnswer: "Entropy measures impurity, disorder, or uncertainty in a set of examples."
  },
  {
    id: "rag-006",
    question: "Describe gradient descent.",
    type: "SUPPORTED",
    expectedConceptId: "con_gradient_descent",
    expectedSourceIds: ["src_1"], expectedChunkIds: ["chunk_1"],
    referenceAnswer: "Gradient descent is an iterative optimization algorithm that minimizes a function by moving along the negative gradient."
  },
  {
    id: "rag-007",
    question: "What does entropy measure in a decision tree?",
    type: "SUPPORTED",
    expectedConceptId: "con_entropy",
    expectedSourceIds: ["src_1"], expectedChunkIds: ["chunk_2"],
    referenceAnswer: "In decision trees, entropy measures the impurity or uncertainty of a set, and splits aim to reduce it."
  },
  {
    id: "rag-008",
    question: "What does information gain tell us?",
    type: "SUPPORTED",
    expectedConceptId: "con_infogain",
    expectedSourceIds: ["src_3"], expectedChunkIds: ["chunk_3"],
    referenceAnswer: "Information gain measures how much uncertainty is reduced by a split."
  },
  {
    id: "rag-009",
    question: "How does backpropagation use the chain rule?",
    type: "SUPPORTED",
    expectedConceptId: "con_backprop",
    expectedSourceIds: ["src_2"], expectedChunkIds: ["chunk_4"],
    referenceAnswer: "Backpropagation applies the chain rule to compute the loss gradient with respect to neural-network weights."
  },
  {
    id: "rag-010",
    question: "What does a derivative measure?",
    type: "SUPPORTED",
    expectedConceptId: "con_derivatives",
    expectedSourceIds: ["src_1"], expectedChunkIds: ["chunk_5"],
    referenceAnswer: "A derivative measures how sensitive a function's output is to a change in its input."
  },
  {
    id: "rag-004",
    question: "Who invented gradient descent?",
    type: "UNSUPPORTED"
  },
  {
    id: "rag-005",
    question: "What is AdamW optimization?",
    type: "UNSUPPORTED"
  },
  {
    id: "rag-011",
    question: "Tell me a joke about penguins.",
    type: "UNSUPPORTED"
  }
];
