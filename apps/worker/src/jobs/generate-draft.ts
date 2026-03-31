export async function generateDraftJob(payload: unknown) {
  return {
    job: 'generate-draft',
    status: 'scaffolded',
    payload
  };
}
