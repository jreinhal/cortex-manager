/**
 * Evaluation templates for rubric-based grading.
 */

const DEFAULT_TEMPLATES = [
  {
    id: 'rubric-clarity-structure',
    name: 'Clarity & Structure',
    description: 'Assess whether the response is clear, structured, and easy to follow.',
    expectedType: 'llm',
    rubric: 'Score clarity, logical structure, and readability. Pass if the response is easy to follow with clear sections.'
  },
  {
    id: 'rubric-groundedness',
    name: 'Groundedness',
    description: 'Check that the response stays aligned to the prompt and avoids hallucinations.',
    expectedType: 'llm',
    rubric: 'Verify the response addresses the prompt without introducing unrelated or fabricated details.'
  },
  {
    id: 'rubric-actionability',
    name: 'Actionability',
    description: 'Check that the response includes concrete next steps.',
    expectedType: 'llm',
    rubric: 'Pass if the response includes clear, actionable next steps or instructions.'
  }
];

module.exports = { DEFAULT_TEMPLATES };
