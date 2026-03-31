export async function transcribeVoiceJob(payload: unknown) {
  return {
    job: 'transcribe-voice',
    status: 'scaffolded',
    payload
  };
}
