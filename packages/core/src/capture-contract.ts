import { nowIso } from './ids';
import type {
  CaptureMethod,
  CapturePagePayload,
  CapturePageType,
  CaptureRecord,
  PortalProvider
} from './types';

export const EXTENSION_CAPTURE_CONTRACT_VERSION = 'extension-capture-v1';

const CAPTURE_METHODS: CaptureMethod[] = ['DOM', 'SCREENSHOT'];
const CAPTURE_PAGE_TYPES: CapturePageType[] = [
  'ATTENDEE_LIST',
  'ATTENDEE_PROFILE',
  'SPEAKER_LIST',
  'SPEAKER_PROFILE',
  'SESSION_LIST',
  'SESSION_PROFILE',
  'UNKNOWN'
];
const PORTAL_PROVIDERS: PortalProvider[] = ['GRIP'];
const MAX_PAGE_TEXT_SUMMARY_LENGTH = 1_200;

export interface ExtensionCaptureRequest {
  contractVersion: typeof EXTENSION_CAPTURE_CONTRACT_VERSION;
  workspaceId: string;
  capture: CapturePagePayload;
}

export interface ExtensionCaptureSummary {
  workspaceId: string;
  pageUrl: string;
  pageTitle: string;
  pageType: CapturePageType;
  capturedAt: string;
  pageTextSummary: string;
  pageArtifactId?: string;
  totalRecords: number;
  addedPeople: number;
  addedSessions: number;
}

export interface ExtensionCaptureSuccessResponse {
  ok: true;
  contractVersion: typeof EXTENSION_CAPTURE_CONTRACT_VERSION;
  summary: ExtensionCaptureSummary;
}

export interface ExtensionCaptureErrorResponse {
  ok: false;
  contractVersion: typeof EXTENSION_CAPTURE_CONTRACT_VERSION;
  error: string;
  issues?: string[];
}

export type ExtensionCaptureResponse =
  | ExtensionCaptureSuccessResponse
  | ExtensionCaptureErrorResponse;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = compactWhitespace(value);
  return normalized || undefined;
}

function isCaptureMethod(value: unknown): value is CaptureMethod {
  return typeof value === 'string' && CAPTURE_METHODS.includes(value as CaptureMethod);
}

function isCapturePageType(value: unknown): value is CapturePageType {
  return typeof value === 'string' && CAPTURE_PAGE_TYPES.includes(value as CapturePageType);
}

function isPortalProvider(value: unknown): value is PortalProvider {
  return typeof value === 'string' && PORTAL_PROVIDERS.includes(value as PortalProvider);
}

function buildPageTextSummary(title: string, pageType: CapturePageType, records: CaptureRecord[]): string {
  const parts = [
    title,
    pageType.replaceAll('_', ' ').toLowerCase(),
    ...records.flatMap((record) =>
      Object.values(record.fields).flatMap((fieldValue) => {
        if (typeof fieldValue === 'string') {
          return [fieldValue];
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.map((item) => String(item));
        }
        return [];
      })
    )
  ]
    .map((value) => compactWhitespace(String(value)))
    .filter(Boolean);

  return truncate(Array.from(new Set(parts)).join(' | '), MAX_PAGE_TEXT_SUMMARY_LENGTH);
}

function normalizeCaptureRecord(value: unknown): CaptureRecord | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const entityType = record.entityType;
  if (entityType !== 'PERSON' && entityType !== 'SESSION') {
    return undefined;
  }

  const fields = asRecord(record.fields) ?? {};
  const selectorHints = Array.isArray(record.selectorHints)
    ? record.selectorHints.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    entityType,
    externalKey: optionalString(record.externalKey),
    fields,
    rawHtmlSnippet: optionalString(record.rawHtmlSnippet),
    selectorHints
  };
}

function normalizeCapturePayload(value: unknown): { capture?: CapturePagePayload; issues: string[] } {
  const payload = asRecord(value);
  if (!payload) {
    return {
      issues: ['capture must be an object']
    };
  }

  const issues: string[] = [];
  const portalProvider = payload.portalProvider;
  const captureMethod = payload.captureMethod;
  const rawPageType = payload.pageType;
  const pageUrl = optionalString(payload.pageUrl);
  const pageTitle = optionalString(payload.pageTitle) ?? pageUrl ?? 'Untitled page';
  const extractorVersion = optionalString(payload.extractorVersion) ?? 'unknown';
  const pageHtml = optionalString(payload.pageHtml);
  const records = Array.isArray(payload.records)
    ? payload.records
        .map((record) => normalizeCaptureRecord(record))
        .filter((record): record is CaptureRecord => Boolean(record))
    : undefined;

  if (!isPortalProvider(portalProvider)) {
    issues.push('capture.portalProvider must be GRIP');
  }
  if (!isCaptureMethod(captureMethod)) {
    issues.push('capture.captureMethod must be DOM or SCREENSHOT');
  }
  if (!pageUrl) {
    issues.push('capture.pageUrl is required');
  }
  if (!Array.isArray(payload.records)) {
    issues.push('capture.records must be an array');
  }

  const pageType = isCapturePageType(rawPageType) ? rawPageType : 'UNKNOWN';
  const capturedAtValue = optionalString(payload.capturedAt) ?? nowIso();
  const capturedAt = Number.isNaN(Date.parse(capturedAtValue)) ? nowIso() : capturedAtValue;
  const pageTextSummary =
    optionalString(payload.pageTextSummary) ??
    buildPageTextSummary(pageTitle, pageType, records ?? []);

  if (issues.length > 0 || !pageUrl || !records || !isPortalProvider(portalProvider) || !isCaptureMethod(captureMethod)) {
    return { issues };
  }

  return {
    issues,
    capture: {
      portalProvider,
      captureMethod,
      pageType,
      pageUrl,
      pageTitle,
      pageTextSummary,
      capturedAt,
      pageHtml,
      extractorVersion,
      records
    }
  };
}

export function createExtensionCaptureRequest(
  workspaceId: string,
  capture: CapturePagePayload
): ExtensionCaptureRequest {
  return {
    contractVersion: EXTENSION_CAPTURE_CONTRACT_VERSION,
    workspaceId,
    capture
  };
}

export function createExtensionCaptureSuccessResponse(
  summary: ExtensionCaptureSummary
): ExtensionCaptureSuccessResponse {
  return {
    ok: true,
    contractVersion: EXTENSION_CAPTURE_CONTRACT_VERSION,
    summary
  };
}

export function createExtensionCaptureErrorResponse(
  error: string,
  issues?: string[]
): ExtensionCaptureErrorResponse {
  return {
    ok: false,
    contractVersion: EXTENSION_CAPTURE_CONTRACT_VERSION,
    error,
    issues
  };
}

export function parseExtensionCaptureRequest(
  input: unknown
):
  | { ok: true; value: ExtensionCaptureRequest }
  | { ok: false; error: string; issues: string[] } {
  const body = asRecord(input);
  if (!body) {
    return {
      ok: false,
      error: 'Capture request body must be an object.',
      issues: ['request body must be an object']
    };
  }

  const workspaceId = optionalString(body.workspaceId);
  if (!workspaceId) {
    return {
      ok: false,
      error: 'workspaceId and capture are required',
      issues: ['workspaceId is required']
    };
  }

  const normalized = normalizeCapturePayload(body.capture);
  if (!normalized.capture) {
    return {
      ok: false,
      error: 'Invalid capture payload.',
      issues: normalized.issues
    };
  }

  return {
    ok: true,
    value: {
      contractVersion: EXTENSION_CAPTURE_CONTRACT_VERSION,
      workspaceId,
      capture: normalized.capture
    }
  };
}

export function parseExtensionCaptureResponse(input: unknown): ExtensionCaptureResponse {
  const response = asRecord(input);

  if (!response || response.ok !== true) {
    return createExtensionCaptureErrorResponse(
      optionalString(response?.error) ?? 'Capture failed.',
      Array.isArray(response?.issues)
        ? response?.issues.filter((issue): issue is string => typeof issue === 'string')
        : undefined
    );
  }

  const summary = asRecord(response.summary);
  if (!summary) {
    return createExtensionCaptureErrorResponse('Capture completed but the response summary was malformed.');
  }

  return createExtensionCaptureSuccessResponse({
    workspaceId: optionalString(summary.workspaceId) ?? '',
    pageUrl: optionalString(summary.pageUrl) ?? '',
    pageTitle: optionalString(summary.pageTitle) ?? 'Untitled page',
    pageType: isCapturePageType(summary.pageType) ? summary.pageType : 'UNKNOWN',
    capturedAt: optionalString(summary.capturedAt) ?? nowIso(),
    pageTextSummary: optionalString(summary.pageTextSummary) ?? '',
    pageArtifactId: optionalString(summary.pageArtifactId),
    totalRecords: typeof summary.totalRecords === 'number' ? summary.totalRecords : 0,
    addedPeople: typeof summary.addedPeople === 'number' ? summary.addedPeople : 0,
    addedSessions: typeof summary.addedSessions === 'number' ? summary.addedSessions : 0
  });
}
