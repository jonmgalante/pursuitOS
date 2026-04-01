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

function personStatusLabel(status?: TargetStatus): string | undefined {
  if (!status) {
    return undefined;
  }

  if (status === 'TARGETED') {
    return 'Targeted';
  }

  if (status === 'MET') {
    return 'Met';
  }

  return 'Missed';
}

function personStatusBadgeClass(status?: TargetStatus): string | undefined {
  if (!status) {
    return undefined;
  }

  if (status === 'MET') {
    return 'badge success';
  }

  if (status === 'MISSED') {
    return 'badge danger';
  }

  return 'badge no-action';
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
  const selectedSpeaker = persons.find((person) => person.id === selectedSpeakerPersonId);
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
  const selectedPersonStatusLabel = personStatusLabel(selectedPerson?.targetStatus);
  const selectedPersonStatusClass = personStatusBadgeClass(selectedPerson?.targetStatus);
  const saveSummary =
    selectedSession?.title ?? selectedSpeaker?.fullName ?? 'No session or speaker context attached';

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

      <section className="card field-panel field-panel-priority">
        <div className="field-panel-header">
          <div className="section-title-stack">
            <p className="section-eyebrow">1. Person selection</p>
            <h2>Pick a person fast</h2>
            <p className="muted">
              Search, tap a quick pick, or pick from the best Target matches before you write the note.
            </p>
          </div>
          <div className="button-row">
            <a className="button-link secondary" href={workspacePath}>
              Main workspace
            </a>
          </div>
        </div>

        <div className="field-command-grid">
          <div className="field-panel-block">
            <label htmlFor="field-search">Search person or target</label>
            <input
              id="field-search"
              className="field-search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, title, or company"
            />
          </div>

          <div className="field-panel-block">
            <p className="field-section-label">Selected person</p>
            {selectedPerson ? (
              <div className="field-selected-person">
                <strong>{selectedPerson.fullName}</strong>
                <p className="muted">{personMeta(selectedPerson)}</p>
                <div className="pill-list">
                  {selectedPerson.priorityLabel ? (
                    <span className={selectedPerson.priorityLabel === 'must meet' ? 'pill must-meet' : 'pill'}>
                      {selectedPerson.priorityLabel}
                    </span>
                  ) : null}
                  {selectedPersonStatusLabel && selectedPersonStatusClass ? (
                    <span className={selectedPersonStatusClass}>{selectedPersonStatusLabel}</span>
                  ) : (
                    <span className="badge no-action">No action</span>
                  )}
                  {selectedPerson.isSpeaker ? <span className="pill insight">Speaker</span> : null}
                </div>
              </div>
            ) : (
              <div className="empty-state field-empty-state">
                Choose a person or Target before saving.
              </div>
            )}
          </div>
        </div>

        <div className="field-panel-block">
          <p className="field-section-label">Quick picks</p>
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

        <div className="field-panel-block">
          <p className="field-section-label">Matches</p>
          <div className="field-result-list">
            {filteredPeople.map((person) => (
              <button
                key={person.id}
                type="button"
                className={person.id === selectedPersonId ? 'field-result active' : 'field-result'}
                onClick={() => setSelectedPersonId(person.id)}
              >
                <span className="field-result-copy">
                  <strong>{person.fullName}</strong>
                  <small>{personMeta(person)}</small>
                </span>
                <span className="field-result-meta">
                  {person.priorityLabel ? (
                    <span className={person.priorityLabel === 'must meet' ? 'pill must-meet' : 'pill'}>
                      {person.priorityLabel}
                    </span>
                  ) : null}
                  {person.targetStatus ? (
                    <span className={personStatusBadgeClass(person.targetStatus)}>
                      {personStatusLabel(person.targetStatus)}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card field-panel">
        <div className="field-panel-header">
          <div className="section-title-stack">
            <p className="section-eyebrow">2. Outcome</p>
            <h2>Mark the interaction</h2>
            <p className="muted">Switch between met and missed before you save so the queue stays correct.</p>
          </div>
        </div>

        <div className="field-selection">
          <div className="field-outcome-panel">
            <p className="field-section-label">Outcome</p>
            <div className="field-segmented">
              {(['MET', 'MISSED'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={outcome === value}
                  className={
                    outcome === value
                      ? `field-segment ${value === 'MET' ? 'field-segment-met' : 'field-segment-missed'} active`
                      : `field-segment ${value === 'MET' ? 'field-segment-met' : 'field-segment-missed'}`
                  }
                  onClick={() => setOutcome(value)}
                >
                  <strong>{value === 'MET' ? 'Met' : 'Missed'}</strong>
                  <span>{value === 'MET' ? 'Rep connected with this person' : 'Rep missed or needs later follow-up'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card field-panel">
        <div className="field-panel-header">
          <div className="section-title-stack">
            <p className="section-eyebrow">3. Note capture</p>
            <h2>Capture what happened</h2>
            <p className="muted">This note becomes the source for follow-up and recent activity confirmation.</p>
          </div>
        </div>

        <div className="field-panel-block">
          <label htmlFor="noteText">What happened?</label>
          <textarea
            id="noteText"
            name="noteText"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Met after the keynote. Asked for pricing and a short demo next week."
            required
          />
          <p className="muted small field-helper-text">
            Keep it short. The structured summary and follow-up draft use this note directly.
          </p>
        </div>
      </section>

      <section className="card field-panel">
        <div className="field-panel-header">
          <div className="section-title-stack">
            <p className="section-eyebrow">4. Tags</p>
            <h2>One-tap tags</h2>
            <p className="muted">Use quick tags to mark the follow-up signal without typing more than you need.</p>
          </div>
          <span className={selectedTags.length > 0 ? 'badge follow-up' : 'badge no-action'}>
            {selectedTags.length > 0
              ? `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} selected`
              : 'No action'}
          </span>
        </div>

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
      </section>

      <section className="card field-panel field-context-panel">
        <div className="field-panel-header">
          <div className="section-title-stack">
            <p className="section-eyebrow">5. Context</p>
            <h2>Optional session or speaker context</h2>
            <p className="muted">Use session intelligence context only when the interaction came from a specific floor moment.</p>
          </div>
          <span className={selectedSession || selectedSpeaker ? 'badge insight' : 'badge no-action'}>
            {selectedSession || selectedSpeaker ? 'Context attached' : 'Optional'}
          </span>
        </div>

        <div className="field-context-grid">
          <div className="field-panel-block">
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

          <div className="field-panel-block">
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

        {selectedSession || selectedSpeaker ? (
          <div className="field-context-summary">
            <div className="pill-list">
              {selectedSession ? <span className="pill insight">Session: {selectedSession.title}</span> : null}
              {selectedSpeaker ? <span className="pill insight">Speaker: {selectedSpeaker.fullName}</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="field-submit-bar">
        <div className="field-submit-copy">
          <strong>{selectedPerson?.fullName ?? 'No person selected'}</strong>
          <p className="muted small">
            {(outcome === 'MET' ? 'Met' : 'Missed')} · {selectedTags.length} tag
            {selectedTags.length === 1 ? '' : 's'} · {saveSummary}
          </p>
        </div>
        <button type="submit" className="field-save-button" disabled={!canSubmit}>
          Save and stay in field mode
        </button>
      </div>
    </form>
  );
}
