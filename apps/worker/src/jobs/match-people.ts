export async function matchPeopleJob(payload: unknown) {
  return {
    job: 'match-people',
    status: 'scaffolded',
    payload
  };
}
