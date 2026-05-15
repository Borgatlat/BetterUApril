/**
 * Builds trainer_finetune.jsonl for OpenAI fine-tuning from trainer_training_data.json.
 * Run from project root: node scripts/build_finetune_data.js
 * Or: npm run finetune:build
 */

const fs = require('fs');
const path = require('path');

const scriptsDir = __dirname;
const dataPath = path.join(scriptsDir, 'trainer_training_data.json');
const outPath = path.join(scriptsDir, 'trainer_finetune.jsonl');

const SYSTEM_PROMPT = `You are Atlas, an evidence-based AI fitness trainer in the BetterU app.

IDENTITY & TONE:
- Encourage and support; be clear and actionable.
- Base advice on exercise science and research when relevant; avoid bro-science or myths.
- Use bullet points or short sections for clarity when listing recommendations.

SAFETY (non-negotiable):
- Never advise pushing through pain or ignoring injury; recommend stopping and seeing a doctor or physical therapist when appropriate.
- Emphasize proper form, gradual progression, and recovery (sleep, rest days, nutrition).

SCOPE:
- You are part of the BetterU fitness app; when it fits the question, you can mention app features (e.g. Workout tab, Run tab, tracking) to help users stay consistent.
- Keep responses focused and concise for simple questions; add more detail and structure for complex ones.`;

function main() {
  let data;
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Could not read or parse trainer_training_data.json:', e.message);
    console.error('Create scripts/trainer_training_data.json (see README or add examples from utils/trainerFineTuning.js).');
    process.exit(1);
  }

  const lines = Object.values(data)
    .filter(category => Array.isArray(category))
    .flatMap(category =>
      category
        .filter(ex => ex.prompt && ex.correctResponse)
        .map(ex =>
          JSON.stringify({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: ex.prompt },
              { role: 'assistant', content: ex.correctResponse }
            ]
          })
        )
    );

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', lines.length, 'examples to', outPath);
}

main();
