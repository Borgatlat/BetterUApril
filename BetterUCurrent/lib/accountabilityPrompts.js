/**
 * Guided accountability prompts — tap to drop text into a check-in field.
 * Each prompt has: id, category, label, question, targetField.
 */

export const ACCOUNTABILITY_PROMPT_CATEGORIES = [
  { id: 'reflection', label: 'Reflection', icon: 'bulb-outline' },
  { id: 'goals', label: 'Goals', icon: 'flag-outline' },
  { id: 'support', label: 'Support', icon: 'heart-outline' },
  { id: 'in_person', label: 'In person', icon: 'people-outline' },
];

/** @typedef {'notes' | 'biggest_win' | 'next_focus' | 'how_you_can_help' | 'message_to_partner' | 'meetup_notes'} AccountabilityField */

/**
 * @type {Array<{
 *   id: string,
 *   category: string,
 *   label: string,
 *   question: string,
 *   targetField: AccountabilityField,
 * }>}
 */
export const ACCOUNTABILITY_PROMPTS = [
  {
    id: 'win',
    category: 'reflection',
    label: 'Celebrate a win',
    question: 'What is one thing you did this week that you are genuinely proud of?',
    targetField: 'biggest_win',
  },
  {
    id: 'hard',
    category: 'reflection',
    label: 'Name the hard part',
    question: 'What felt hardest this week, and what did you learn from it?',
    targetField: 'notes',
  },
  {
    id: 'gratitude',
    category: 'reflection',
    label: 'Gratitude',
    question: 'Who or what helped you stay on track this week?',
    targetField: 'message_to_partner',
  },
  {
    id: 'goal_progress',
    category: 'goals',
    label: 'Goal honesty',
    question: 'Which goal did you move forward on — even a little?',
    targetField: 'notes',
  },
  {
    id: 'next_week_one',
    category: 'goals',
    label: 'One priority',
    question: 'What is the ONE thing you will protect time for next week?',
    targetField: 'next_focus',
  },
  {
    id: 'ask_help',
    category: 'support',
    label: 'Ask for help',
    question: 'What specific encouragement or accountability do you need from your partner?',
    targetField: 'how_you_can_help',
  },
  {
    id: 'offer_help',
    category: 'support',
    label: 'Offer support',
    question: 'How can you show up for your partner this week (text, prayer, study hall, etc.)?',
    targetField: 'message_to_partner',
  },
  {
    id: 'meetup_plan',
    category: 'in_person',
    label: 'Plan the chat',
    question: 'When and where could you meet in person for 15 minutes this week?',
    targetField: 'meetup_notes',
  },
  {
    id: 'meetup_agenda',
    category: 'in_person',
    label: 'Conversation starters',
    question:
      'Pick two: wins, struggles, sleep, faith, grades, training, family. What will you ask each other?',
    targetField: 'meetup_notes',
  },
  {
    id: 'meetup_commit',
    category: 'in_person',
    label: 'Commit together',
    question: 'What will you both do before the next meetup to keep each other honest?',
    targetField: 'meetup_notes',
  },
];

export function getPromptsByCategory(categoryId) {
  return ACCOUNTABILITY_PROMPTS.filter((p) => p.category === categoryId);
}

export function getPromptById(id) {
  return ACCOUNTABILITY_PROMPTS.find((p) => p.id === id);
}
