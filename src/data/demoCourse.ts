import { Course, Topic, Concept, Source, LearnerModel } from '../types/domain';

export const demoSources: Source[] = [
  { id: 'src_1', title: 'Machine Learning Basics Textbook', type: 'TEXTBOOK' },
  { id: 'src_2', title: 'Lecture 3: Optimization', type: 'VIDEO' },
  { id: 'src_3', title: 'Week 4 Slides', type: 'SLIDE' }
];

export const demoCourse: Course = {
  id: 'course_ml_101',
  title: 'Introduction to Machine Learning',
  description: 'Foundational concepts in ML, optimization, and models.',
  sources: demoSources,
};

export const demoTopics: Topic[] = [
  { id: 'topic_1', courseId: 'course_ml_101', name: 'Foundations', order: 1 },
  { id: 'topic_2', courseId: 'course_ml_101', name: 'Optimization', order: 2 },
  { id: 'topic_3', courseId: 'course_ml_101', name: 'Decision Trees', order: 3 },
];

export const demoConcepts: Concept[] = [
  {
    id: 'con_entropy',
    topicId: 'topic_3',
    name: 'Entropy',
    description: 'A measure of impurity or randomness in a dataset.',
    prerequisites: [],
    sourceReferences: [
      { id: 'ref_1', sourceId: 'src_1', sourceType: 'TEXTBOOK', location: 'Page 142', label: 'Textbook Ch 4.1', excerpt: 'Entropy is defined as...' }
    ]
  },
  {
    id: 'con_infogain',
    topicId: 'topic_3',
    name: 'Information Gain',
    description: 'Reduction in entropy by splitting a dataset.',
    prerequisites: [{ conceptId: 'con_entropy', isHardRequirement: true }],
    sourceReferences: [
      { id: 'ref_2', sourceId: 'src_1', sourceType: 'TEXTBOOK', location: 'Page 145', label: 'Textbook Ch 4.2', excerpt: 'Information Gain is...' },
      { id: 'ref_3', sourceId: 'src_3', sourceType: 'SLIDE', location: 'Slide 12', label: 'Week 4 Slide 12' }
    ]
  },
  {
    id: 'con_derivatives',
    topicId: 'topic_1',
    name: 'Derivatives',
    description: 'Rate of change of a function.',
    prerequisites: [],
    sourceReferences: [
      { id: 'ref_4', sourceId: 'src_1', sourceType: 'TEXTBOOK', location: 'Page 20', label: 'Math Review' }
    ]
  },
  {
    id: 'con_partial_deriv',
    topicId: 'topic_1',
    name: 'Partial Derivatives',
    description: 'Derivatives for multivariate functions.',
    prerequisites: [{ conceptId: 'con_derivatives', isHardRequirement: true }],
    sourceReferences: [
      { id: 'ref_5', sourceId: 'src_1', sourceType: 'TEXTBOOK', location: 'Page 25', label: 'Math Review' }
    ]
  },
  {
    id: 'con_gradient_descent',
    topicId: 'topic_2',
    name: 'Gradient Descent',
    description: 'First-order iterative optimization algorithm for finding a local minimum of a differentiable function.',
    prerequisites: [{ conceptId: 'con_partial_deriv', isHardRequirement: true }],
    sourceReferences: [
      { id: 'ref_6', sourceId: 'src_2', sourceType: 'VIDEO', location: '18:42', label: 'Lecture 3 - 18:42' },
      { id: 'ref_7', sourceId: 'src_1', sourceType: 'TEXTBOOK', location: 'Page 143', label: 'Optimization Chapter' }
    ]
  },
  {
    id: 'con_backprop',
    topicId: 'topic_2',
    name: 'Backpropagation',
    description: 'Algorithm used to calculate derivatives in neural networks.',
    prerequisites: [{ conceptId: 'con_gradient_descent', isHardRequirement: true }],
    sourceReferences: [
      { id: 'ref_8', sourceId: 'src_2', sourceType: 'VIDEO', location: '30:15', label: 'Lecture 3 - 30:15' }
    ]
  }
];

export const demoLearnerModel: LearnerModel = {
  userId: 'user_1',
  courseId: 'course_ml_101',
  history: [],
  masteryStates: {
    'con_entropy': {
      conceptId: 'con_entropy', masteryScore: 0.95, confidenceScore: 0.9,
      attempts: 5, correct: 5, incorrect: 0, recentPerformance: [true, true, true, true, true], consecutiveIncorrect: 0, activeMisconceptions: [], trend: 'UP', difficulty: 0.3, prerequisiteStatus: 'CLEARED'
    },
    'con_infogain': {
      conceptId: 'con_infogain', masteryScore: 0.35, confidenceScore: 0.4,
      attempts: 3, correct: 1, incorrect: 2, recentPerformance: [true, false, false], consecutiveIncorrect: 2, activeMisconceptions: [], trend: 'DOWN', difficulty: 0.6, prerequisiteStatus: 'CLEARED'
    },
    'con_derivatives': {
      conceptId: 'con_derivatives', masteryScore: 0.90, confidenceScore: 0.85,
      attempts: 2, correct: 2, incorrect: 0, recentPerformance: [true, true], consecutiveIncorrect: 0, activeMisconceptions: [], trend: 'STABLE', difficulty: 0.2, prerequisiteStatus: 'CLEARED'
    },
    'con_partial_deriv': {
      conceptId: 'con_partial_deriv', masteryScore: 0.85, confidenceScore: 0.8,
      attempts: 4, correct: 3, incorrect: 1, recentPerformance: [true, false, true, true], consecutiveIncorrect: 0, activeMisconceptions: [], trend: 'UP', difficulty: 0.5, prerequisiteStatus: 'CLEARED'
    },
    'con_gradient_descent': {
      conceptId: 'con_gradient_descent', masteryScore: 0.72, confidenceScore: 0.65,
      attempts: 6, correct: 4, incorrect: 2, recentPerformance: [true, true, false, true, true], consecutiveIncorrect: 0, activeMisconceptions: [], trend: 'UP', difficulty: 0.7, prerequisiteStatus: 'CLEARED'
    },
    'con_backprop': {
      conceptId: 'con_backprop', masteryScore: 0.10, confidenceScore: 0.2,
      attempts: 1, correct: 0, incorrect: 1, recentPerformance: [false], consecutiveIncorrect: 1, activeMisconceptions: [], trend: 'STABLE', difficulty: 0.9, prerequisiteStatus: 'PARTIAL'
    }
  }
};
