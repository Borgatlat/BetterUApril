/**
 * Uploads trainer_finetune.jsonl to OpenAI and creates a fine-tuning job.
 * Reads API key from .env (EXPO_PUBLIC_OPENAI_API_KEY or OPENAI_API_KEY).
 * Run from project root: node scripts/upload_finetune.js
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
const jsonlPath = path.join(__dirname, 'trainer_finetune.jsonl');

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    console.error('No .env file found in project root.');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

async function main() {
  const env = loadEnv();
  const key = env.EXPO_PUBLIC_OPENAI_API_KEY || env.OPENAI_API_KEY;
  if (!key) {
    console.error('No OPENAI_API_KEY or EXPO_PUBLIC_OPENAI_API_KEY in .env');
    process.exit(1);
  }

  if (!fs.existsSync(jsonlPath)) {
    console.error('trainer_finetune.jsonl not found. Run: npm run finetune:build');
    process.exit(1);
  }

  console.log('Uploading trainer_finetune.jsonl to OpenAI...');
  const formData = new FormData();
  formData.append('purpose', 'fine-tune');
  formData.append('file', new Blob([fs.readFileSync(jsonlPath)]), 'trainer_finetune.jsonl');

  const uploadRes = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error('Upload failed:', uploadRes.status, err);
    process.exit(1);
  }

  const uploadData = await uploadRes.json();
  const fileId = uploadData.id;
  console.log('Uploaded. File ID:', fileId);

  console.log('Creating fine-tuning job...');
  const jobRes = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      training_file: fileId,
      model: 'gpt-3.5-turbo',
      suffix: 'betteru-trainer'
    })
  });

  if (!jobRes.ok) {
    const err = await jobRes.text();
    console.error('Create job failed:', jobRes.status, err);
    process.exit(1);
  }

  const jobData = await jobRes.json();
  console.log('Job created. Job ID:', jobData.id);
  console.log('Check status: https://platform.openai.com/finetune');
  console.log('When complete, add to .env:');
  console.log('EXPO_PUBLIC_FINETUNED_TRAINER_MODEL=<fine_tuned_model from job>');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
