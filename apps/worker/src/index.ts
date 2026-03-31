import { generateDraftJob } from './jobs/generate-draft';
import { matchPeopleJob } from './jobs/match-people';
import { transcribeVoiceJob } from './jobs/transcribe-voice';

async function main() {
  const jobs = [
    await generateDraftJob({ ready: true }),
    await matchPeopleJob({ ready: true }),
    await transcribeVoiceJob({ ready: true })
  ];

  console.log('Conference Rep Copilot worker scaffold online.');
  console.table(jobs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
