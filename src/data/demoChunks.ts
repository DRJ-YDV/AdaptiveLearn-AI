import { DocumentChunk } from '../types/rag';

export const demoDocumentChunks: DocumentChunk[] = [
  {
    id: 'chunk_1',
    text: 'Gradient descent is an optimization algorithm used to minimize some function by iteratively moving in the direction of steepest descent as defined by the negative of the gradient.',
    metadata: {
      sourceId: 'src_1',
      sourceTitle: 'Machine Learning Basics Textbook',
      sourceType: 'TEXTBOOK',
      location: 'Page 143',
      conceptId: 'con_gradient_descent',
      topicId: 'topic_2'
    }
  },
  {
    id: 'chunk_2',
    text: 'Entropy is a measure of impurity, disorder, or uncertainty in a set of examples. In decision trees, we seek to split data in a way that minimizes entropy.',
    metadata: {
      sourceId: 'src_1',
      sourceTitle: 'Machine Learning Basics Textbook',
      sourceType: 'TEXTBOOK',
      location: 'Page 142',
      conceptId: 'con_entropy',
      topicId: 'topic_3'
    }
  },
  {
    id: 'chunk_3',
    text: 'Information gain is calculated by subtracting the weighted average of the entropy of the child nodes from the entropy of the parent node. It tells us how much uncertainty was reduced.',
    metadata: {
      sourceId: 'src_3',
      sourceTitle: 'Week 4 Slides',
      sourceType: 'SLIDE',
      location: 'Slide 12',
      conceptId: 'con_infogain',
      topicId: 'topic_3'
    }
  },
  {
    id: 'chunk_4',
    text: 'Backpropagation computes the gradient of the loss function with respect to the weights of the network for a single input-output example, relying heavily on the chain rule.',
    metadata: {
      sourceId: 'src_2',
      sourceTitle: 'Lecture 3: Optimization',
      sourceType: 'VIDEO',
      location: '30:15',
      conceptId: 'con_backprop',
      topicId: 'topic_2'
    }
  },
  {
    id: 'chunk_5',
    text: 'The derivative of a function of a real variable measures the sensitivity to change of the function value (output value) with respect to a change in its argument (input value).',
    metadata: {
      sourceId: 'src_1',
      sourceTitle: 'Machine Learning Basics Textbook',
      sourceType: 'TEXTBOOK',
      location: 'Page 20',
      conceptId: 'con_derivatives',
      topicId: 'topic_1'
    }
  }
];
