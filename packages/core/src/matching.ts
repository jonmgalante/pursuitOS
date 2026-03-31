import type { HubSpotDirectoryRecord, MatchMethod, Person } from './types';

export function normalizeCompanyName(input?: string): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/[,.\-_/]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function emailDomain(email?: string): string | undefined {
  if (!email || !email.includes('@')) {
    return undefined;
  }

  return email.split('@')[1]?.toLowerCase();
}

export interface MatchResult {
  hubspotContactId?: string;
  matchMethod: MatchMethod;
}

export function deterministicHubSpotMatch(
  person: Pick<Person, 'primaryEmail' | 'fullName'> & { companyName?: string },
  directory: HubSpotDirectoryRecord[]
): MatchResult {
  const normalizedCompany = normalizeCompanyName(person.companyName);
  const personDomain = emailDomain(person.primaryEmail);

  const emailMatch = directory.find(
    (entry) => entry.email?.toLowerCase() === person.primaryEmail?.toLowerCase()
  );

  if (emailMatch) {
    return {
      hubspotContactId: emailMatch.id,
      matchMethod: 'DETERMINISTIC_EMAIL'
    };
  }

  const domainMatch = directory.find((entry) => {
    return entry.companyDomain?.toLowerCase() === personDomain && !!personDomain;
  });

  if (domainMatch) {
    return {
      hubspotContactId: domainMatch.id,
      matchMethod: 'DETERMINISTIC_DOMAIN'
    };
  }

  const companyMatch = directory.find((entry) => {
    return normalizeCompanyName(entry.companyName) === normalizedCompany && normalizedCompany.length > 0;
  });

  if (companyMatch) {
    return {
      hubspotContactId: companyMatch.id,
      matchMethod: 'DETERMINISTIC_COMPANY'
    };
  }

  return {
    matchMethod: 'NONE'
  };
}
