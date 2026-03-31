import {
  DEMO_ATTENDEES,
  DEMO_SESSIONS,
  type CapturePagePayload,
  type Encounter,
  type FollowUpDraft,
  type TargetPriority,
  type TargetStatus,
  type Task
} from '@copilot/core';
import type {
  IngestCaptureBatchResult,
  WorkspaceListItem
} from './repositories/first-slice-repository';
import { getFirstSliceService, type WorkspaceView } from './services/first-slice-service';

const firstSliceService = getFirstSliceService();

export async function ensureDemoWorkspace(): Promise<string> {
  return firstSliceService.ensureDemoWorkspace();
}

export async function listWorkspaces(): Promise<WorkspaceListItem[]> {
  return firstSliceService.listWorkspaces();
}

export async function getWorkspaceView(workspaceId: string): Promise<WorkspaceView> {
  return firstSliceService.getWorkspaceView(workspaceId);
}

export async function ingestCapture(
  workspaceId: string,
  capture: CapturePagePayload
): Promise<IngestCaptureBatchResult> {
  return firstSliceService.ingestCapture(workspaceId, capture);
}

export async function markTarget(workspaceId: string, personId: string, priority: TargetPriority): Promise<void> {
  await firstSliceService.markTarget(workspaceId, personId, priority);
}

export async function updateTargetStatus(
  workspaceId: string,
  personId: string,
  status: TargetStatus
): Promise<void> {
  await firstSliceService.updateTargetStatus(workspaceId, personId, status);
}

export async function logEncounter(params: {
  workspaceId: string;
  personId: string;
  noteText: string;
  tags: string[];
  outcome?: 'MET' | 'MISSED';
  sessionId?: string;
  speakerPersonId?: string;
  capturedVia: Encounter['capturedVia'];
}): Promise<Encounter> {
  return firstSliceService.logEncounter(params);
}

export async function generateDraft(workspaceId: string, personId: string): Promise<FollowUpDraft> {
  return firstSliceService.generateDraft(workspaceId, personId);
}

export async function syncHubSpotTaskForPerson(workspaceId: string, personId: string): Promise<Task> {
  return firstSliceService.syncHubSpotTaskForPerson(workspaceId, personId);
}

export async function syncGmailDraftById(workspaceId: string, draftId: string): Promise<FollowUpDraft> {
  return firstSliceService.syncGmailDraftById(workspaceId, draftId);
}

export function demoAttendeeCards() {
  return DEMO_ATTENDEES;
}

export function demoSessionCards() {
  return DEMO_SESSIONS;
}
