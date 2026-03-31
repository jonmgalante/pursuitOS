'use client';

import type { TargetStatus } from '@copilot/core';
import { useDeferredValue, useEffect, useState } from 'react';

export interface FieldModePersonOption {
  id: string;
  fullName: string;
  title?: string;
  companyName: string;
  priorityLabel?: string;
  targetStatus?: TargetStatus;
  isSpeaker: boolean;
}

export interface FieldModeSessionOption {
  id: string;
  title: string;
  location?: string;
  startsAt?: string;
  speakerPersonIds: string[];
}

interface FieldModeFormProps {
  workspaceId: string;
  fieldPath: string;
  workspacePath: string;
  persons: FieldModePersonOption[];
  quickPickPersonIds: string[];
  sessions: FieldModeSessionOption[];
  initialPersonId?: string;
  initialSessionId?: string;
  initialSpeakerPersonId?: string;
}

const FIELD_TAGS = ['demo', 'pricing', 'speaker', 'integration', 'follow-up', 'urgent'];

function matchesPerson(person: FieldModePersonOption, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [person.fullName, person.title ?? '', person.companyName].join(' ').toLowerCase();
  return haystack.includes(query);
}

function personMeta(person: FieldModePersonOption): string {
  const parts = [person.title, person.companyName].filter(Boolean);
  return parts.join(' · ') || 'Captured person';
}

function sessionLabel(session: FieldModeSessionOption): string {
  const parts = [session.title, session.location].filter(Boolean);
  return parts.join(' · ');
}

export function FieldModeForm({
  workspaceId,
  fieldPath,
  workspacePath,
  persons,
  quickPickPersonIds,
  sessions,
  initialPersonId,
  initialSessionId,
  initialSpeakerPersonId
}: FieldModeFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId ?? '');
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId ?? '');
  const [selectedSpeakerPersonId, setSelectedSpeakerPersonId] = useState(initialSpeakerPersonId ?? '');
  const [noteText, setNoteText] = useState('');
  const [outcome, setOutcome] = useState<'MET' | 'MISSED'>('MET');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const selectedPerson = persons.find((person) => person.id === selectedPersonId);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const availableSpeakers = selectedSession
    ? persons.filter((person) => selectedSession.speakerPersonIds.includes(person.id))
    : [];

  useEffect(() => {
    if (
      selectedSpeakerPersonId &&
      !availableSpeakers.some((person) => person.id === selectedSpeakerPersonId)
    ) {
      setSelectedSpeakerPersonId('');
    }
  }, [availableSpeakers, selectedSpeakerPersonId]);

  const quickPickPeople = quickPickPersonIds
    .map((personId) => persons.find((person) => person.id === personId))
    .filter((person): person is FieldModePersonOption => Boolean(person));

  const filteredPeople = persons.filter((person) => matchesPerson(person, deferredQuery)).slice(0, 12);
  const canSubmit = Boolean(selectedPersonId && noteText.trim());
  const redirectParams = new URLSearchParams({ saved: '1' });

  if (selectedPersonId) {
    redirectParams.set('personId', selectedPersonId);
  }

  if (selectedSessionId) {
    redirectParams.set('sessionId', selectedSessionId);
  }

  const redirectTo = `${fieldPath}?${redirectParams.toString()}`;

  return (
    <form action="/api/encounters" method="post" className="field-layout">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="personId" value={selectedPersonId} />
      <input type="hidden" name="capturedVia" value="MANUAL" />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="outcome" value={outcome} />
      {selectedSessionId ? <input type="hidden" name="sessionId" value={selectedSessionId} /> : null}
      {selectedSpeakerPersonId ? (
        <input type="hidden" name="speakerPersonId" value={selectedSpeakerPersonId} />
      ) : null}
      {selectedTags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}

      <section className="card field-panel">
        <div className="field-panel-header">
          <div>
            <h2>Log encounter fast</h2>
            <p className="muted">Pick a person, capture the note, tap met or missed, and stay in field mode.</p>
          </div>
          <div className="button-row">
            <a className="button-link secondary" href={workspacePath}>
              Main workspace
            </a>
          </div>
        </div>

        <div className="stack">
          <div>
            <label htmlFor="field-search">Search person or target</label>
            <input
              id="field-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, title, or company"
            />
          </div>

          <div>
            <label>Quick picks</label>
            <div className="field-chip-grid">
              {quickPickPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={person.id === selectedPersonId ? 'field-chip active' : 'field-chip'}
                  onClick={() => setSelectedPersonId(person.id)}
                >
                  <strong>{person.fullName}</strong>
                  <span>{person.priorityLabel ?? 'Captured person'}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label>Matches</label>
            <div className="field-result-list">
              {filteredPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={person.id === selectedPersonId ? 'field-result active' : 'field-result'}
                  onClick={() => setSelectedPersonId(person.id)}
                >
                  <span>
                    <strong>{person.fullName}</strong>
                    <small>{personMeta(person)}</small>
                  </span>
                  <span className="field-result-meta">
                    {person.priorityLabel ? <span className="badge neutral">{person.priorityLabel}</span> : null}
                    {person.targetStatus ? (
                      <span
                        className={
                          person.targetStatus === 'MET'
                            ? 'badge success'
                            : person.targetStatus === 'MISSED'
                              ? 'badge danger'
                              : 'badge neutral'
                        }
                      >
                        {person.targetStatus.toLowerCase()}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card field-panel">
        <div className="stack">
          <div className="field-selection">
            <div>
              <p className="field-section-label">Selected person</p>
              {selectedPerson ? (
                <div className="field-selected-person">
                  <strong>{selectedPerson.fullName}</strong>
                  <p className="muted">{personMeta(selectedPerson)}</p>
                  <div className="pill-list">
                    {selectedPerson.priorityLabel ? <span className="pill">{selectedPerson.priorityLabel}</span> : null}
                    {selectedPerson.targetStatus ? <span className="pill">{selectedPerson.targetStatus.toLowerCase()}</span> : null}
                    {selectedPerson.isSpeaker ? <span className="pill">speaker</span> : null}
                  </div>
                </div>
              ) : (
                <p className="muted">Choose a person or target before saving.</p>
              )}
            </div>

            <div>
              <p className="field-section-label">Outcome</p>
              <div className="field-segmented">
                {(['MET', 'MISSED'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={outcome === value ? 'field-segment active' : 'field-segment'}
                    onClick={() => setOutcome(value)}
                  >
                    {value === 'MET' ? 'Met' : 'Missed'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="noteText">What happened?</label>
            <textarea
              id="noteText"
              name="noteText"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Met after the keynote. Asked for pricing and a short demo next week."
              required
            />
          </div>

          <div>
            <label>One-tap tags</label>
            <div className="field-tag-grid">
              {FIELD_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'field-tag active' : 'field-tag'}
                    onClick={() =>
                      setSelectedTags((current) =>
                        current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
                      )
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid two">
            <div>
              <label htmlFor="sessionId">Attach session context</label>
              <select
                id="sessionId"
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
              >
                <option value="">No session context</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {sessionLabel(session)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="speakerPersonId">Attach speaker context</label>
              <select
                id="speakerPersonId"
                value={selectedSpeakerPersonId}
                onChange={(event) => setSelectedSpeakerPersonId(event.target.value)}
                disabled={!selectedSession}
              >
                <option value="">{selectedSession ? 'No speaker context' : 'Pick a session first'}</option>
                {availableSpeakers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <div className="field-submit-bar">
        <div>
          <strong>{selectedPerson?.fullName ?? 'No person selected'}</strong>
          <p className="muted small">{selectedSession ? selectedSession.title : 'No session context attached'}</p>
        </div>
        <button type="submit" disabled={!canSubmit}>
          Save and stay in field mode
        </button>
      </div>
    </form>
  );
}
