import { Question, Misconception } from '../types/domain';
import { demoConcepts } from './demoCourse';

export const demoMisconceptions: Misconception[] = [
  {
    id: 'misc_gd_1',
    conceptId: 'con_gradient_descent',
    description: 'Believing gradient descent always finds the global minimum.',
    severity: 'HIGH'
  },
  {
    id: 'misc_info_1',
    conceptId: 'con_infogain',
    description: 'Confusing Information Gain with Entropy.',
    severity: 'MEDIUM'
  }
];

export const demoQuestions: Question[] = [
  {
    id: 'q_gd_1',
    type: 'MCQ',
    prompt: 'Which of the following best describes what Gradient Descent optimizes?',
    conceptId: 'con_gradient_descent',
    topicId: 'topic_2',
    difficulty: 0.3,
    explanation: 'Gradient descent minimizes the loss function by iteratively moving in the direction of steepest descent.',
    sourceReferences: demoConcepts.find(c => c.id === 'con_gradient_descent')!.sourceReferences,
    tags: ['basics', 'optimization'],
    options: [
      { id: 'opt_1', text: 'It minimizes the loss function.', isCorrect: true },
      { id: 'opt_2', text: 'It maximizes the loss function.', isCorrect: false },
      { id: 'opt_3', text: 'It always finds the global minimum of any function.', isCorrect: false, misconceptionId: 'misc_gd_1' },
      { id: 'opt_4', text: 'It computes the exact derivative without iteration.', isCorrect: false }
    ]
  },
  {
    id: 'q_gd_2',
    type: 'MCQ',
    prompt: 'If the learning rate in Gradient Descent is too high, what is the most likely outcome?',
    conceptId: 'con_gradient_descent',
    topicId: 'topic_2',
    difficulty: 0.6,
    explanation: 'A very high learning rate can cause the algorithm to overshoot the minimum and diverge.',
    sourceReferences: demoConcepts.find(c => c.id === 'con_gradient_descent')!.sourceReferences,
    tags: ['hyperparameters', 'optimization'],
    options: [
      { id: 'opt_1', text: 'It will converge much faster to the global minimum.', isCorrect: false },
      { id: 'opt_2', text: 'It may overshoot the minimum and fail to converge.', isCorrect: true },
      { id: 'opt_3', text: 'It will get stuck in a local minimum instantly.', isCorrect: false },
      { id: 'opt_4', text: 'The loss function will become zero.', isCorrect: false }
    ]
  },
  {
    id: 'q_entropy_1',
    type: 'MCQ',
    prompt: 'In the context of decision trees, what does a higher entropy value indicate?',
    conceptId: 'con_entropy',
    topicId: 'topic_3',
    difficulty: 0.4,
    explanation: 'Higher entropy means the node is less pure (i.e., it contains a more mixed set of classes).',
    sourceReferences: demoConcepts.find(c => c.id === 'con_entropy')!.sourceReferences,
    tags: ['decision_trees', 'purity'],
    options: [
      { id: 'opt_1', text: 'Higher purity of the node.', isCorrect: false },
      { id: 'opt_2', text: 'Greater impurity or randomness in the node.', isCorrect: true },
      { id: 'opt_3', text: 'The node is perfectly classified.', isCorrect: false },
      { id: 'opt_4', text: 'The reduction in uncertainty.', isCorrect: false, misconceptionId: 'misc_info_1' }
    ]
  },
  {
    id: 'q_infogain_1',
    type: 'MCQ',
    prompt: 'How is Information Gain calculated for a potential split in a decision tree?',
    conceptId: 'con_infogain',
    topicId: 'topic_3',
    difficulty: 0.7,
    explanation: 'Information Gain is the entropy of the parent node minus the weighted average entropy of the child nodes.',
    sourceReferences: demoConcepts.find(c => c.id === 'con_infogain')!.sourceReferences,
    tags: ['decision_trees', 'calculation'],
    options: [
      { id: 'opt_1', text: 'By adding the entropies of all child nodes.', isCorrect: false },
      { id: 'opt_2', text: 'Parent Entropy - Weighted Average of Child Entropies.', isCorrect: true },
      { id: 'opt_3', text: 'Weighted Average of Child Entropies - Parent Entropy.', isCorrect: false },
      { id: 'opt_4', text: 'By measuring the randomness of the dataset directly.', isCorrect: false, misconceptionId: 'misc_info_1' }
    ]
  },
  {
    id: 'q_deriv_1',
    type: 'MCQ',
    prompt: 'What does the derivative of a function represent?',
    conceptId: 'con_derivatives',
    topicId: 'topic_1',
    difficulty: 0.2,
    explanation: 'The derivative represents the instantaneous rate of change of a function with respect to its variable.',
    sourceReferences: demoConcepts.find(c => c.id === 'con_derivatives')!.sourceReferences,
    tags: ['math', 'calculus'],
    options: [
      { id: 'opt_1', text: 'The total area under the curve.', isCorrect: false },
      { id: 'opt_2', text: 'The instantaneous rate of change of the function.', isCorrect: true },
      { id: 'opt_3', text: 'The maximum value of the function.', isCorrect: false },
      { id: 'opt_4', text: 'The distance between two points.', isCorrect: false }
    ]
  },
  {
    id: 'q_partial_deriv_1',
    type: 'MCQ',
    prompt: 'When computing the partial derivative of f(x,y) with respect to x, how is y treated?',
    conceptId: 'con_partial_deriv',
    topicId: 'topic_1',
    difficulty: 0.5,
    explanation: 'When computing a partial derivative with respect to one variable, all other variables are treated as constants.',
    sourceReferences: demoConcepts.find(c => c.id === 'con_partial_deriv')!.sourceReferences,
    tags: ['math', 'calculus'],
    options: [
      { id: 'opt_1', text: 'As a variable that also changes with x.', isCorrect: false },
      { id: 'opt_2', text: 'As zero.', isCorrect: false },
      { id: 'opt_3', text: 'As a constant.', isCorrect: true },
      { id: 'opt_4', text: 'It is factored out of the equation entirely.', isCorrect: false }
    ]
  },
  {
    id: 'q_backprop_1',
    type: 'MCQ',
    prompt: 'What mathematical rule is fundamental to the backpropagation algorithm?',
    conceptId: 'con_backprop',
    topicId: 'topic_2',
    difficulty: 0.6,
    explanation: 'Backpropagation relies on the Chain Rule of calculus to compute derivatives through composed functions (layers).',
    sourceReferences: demoConcepts.find(c => c.id === 'con_backprop')!.sourceReferences,
    tags: ['neural_networks', 'math'],
    options: [
      { id: 'opt_1', text: 'The Product Rule', isCorrect: false },
      { id: 'opt_2', text: 'The Quotient Rule', isCorrect: false },
      { id: 'opt_3', text: 'The Chain Rule', isCorrect: true },
      { id: 'opt_4', text: 'The Power Rule', isCorrect: false }
    ]
  },
  {
    id: 'q_backprop_2',
    type: 'MCQ',
    prompt: 'In backpropagation, gradients are computed moving in which direction?',
    conceptId: 'con_backprop',
    topicId: 'topic_2',
    difficulty: 0.7,
    explanation: 'Gradients are computed from the output layer backwards to the input layer.',
    sourceReferences: demoConcepts.find(c => c.id === 'con_backprop')!.sourceReferences,
    tags: ['neural_networks'],
    options: [
      { id: 'opt_1', text: 'From the input layer to the output layer.', isCorrect: false },
      { id: 'opt_2', text: 'From the output layer backward to the input layer.', isCorrect: true },
      { id: 'opt_3', text: 'Simultaneously across all layers.', isCorrect: false },
      { id: 'opt_4', text: 'Only at the hidden layers.', isCorrect: false }
    ]
  }
];
