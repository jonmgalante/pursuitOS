import assert from 'node:assert/strict';
import { detectGripPageType, extractGripVisiblePage } from '../src/extractor';

type ChildNode = FakeElement | string;

class FakeElement {
  readonly tagName: string;
  readonly children: ChildNode[];
  readonly attributes: Record<string, string>;
  readonly visible: boolean;
  parentElement: FakeElement | null = null;

  constructor(
    tagName: string,
    attributes: Record<string, string> = {},
    children: ChildNode[] = [],
    options?: { visible?: boolean }
  ) {
    this.tagName = tagName.toLowerCase();
    this.attributes = attributes;
    this.children = children;
    this.visible = options?.visible ?? true;

    for (const child of children) {
      if (child instanceof FakeElement) {
        child.parentElement = this;
      }
    }
  }

  get textContent(): string {
    return this.children
      .map((child) => (child instanceof FakeElement ? child.textContent : child))
      .join('');
  }

  get outerHTML(): string {
    const attrs = Object.entries(this.attributes)
      .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
      .join('');
    const children = this.children
      .map((child) => (child instanceof FakeElement ? child.outerHTML : escapeHtml(child)))
      .join('');

    return `<${this.tagName}${attrs}>${children}</${this.tagName}>`;
  }

  get offsetParent(): object | null {
    return this.visible ? {} : null;
  }

  get offsetWidth(): number {
    return this.visible ? 100 : 0;
  }

  get offsetHeight(): number {
    return this.visible ? 20 : 0;
  }

  get isConnected(): boolean {
    return true;
  }

  get href(): string {
    return this.getAttribute('href') ?? '';
  }

  getBoundingClientRect(): { width: number; height: number } {
    return {
      width: this.visible ? 100 : 0,
      height: this.visible ? 20 : 0
    };
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const parsed = parseSelector(selector);
    const results: FakeElement[] = [];

    for (const child of this.children) {
      if (!(child instanceof FakeElement)) {
        continue;
      }

      walk(child, (element) => {
        if (matchesSelector(element, parsed)) {
          results.push(element);
        }
      });
    }

    return results;
  }
}

class FakeDocument {
  readonly title: string;
  readonly documentElement: FakeElement;

  constructor(title: string, bodyChildren: ChildNode[]) {
    this.title = title;
    this.documentElement = new FakeElement('html', {}, [
      new FakeElement('body', {}, bodyChildren)
    ]);
  }

  querySelector(selector: string): FakeElement | null {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.documentElement.querySelectorAll(selector);
  }
}

interface ParsedSelector {
  tagName?: string;
  classNames: string[];
  attributes: Array<{ name: string; operator: 'exists' | '=' | '^='; value?: string }>;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function walk(element: FakeElement, visit: (element: FakeElement) => void): void {
  visit(element);
  for (const child of element.children) {
    if (child instanceof FakeElement) {
      walk(child, visit);
    }
  }
}

function parseSelector(selector: string): ParsedSelector {
  const source = selector.trim();
  const tagMatch = source.match(/^[a-z0-9-]+/i);
  const classMatches = [...source.matchAll(/\.([a-z0-9_-]+)/gi)];
  const attributeMatches = [...source.matchAll(/\[([^\]=~^$*|]+)(\^?=)?(?:"([^"]*)"|'([^']*)')?\]/g)];

  return {
    tagName: tagMatch?.[0]?.toLowerCase(),
    classNames: classMatches.map((match) => match[1]).filter((value): value is string => Boolean(value)),
    attributes: attributeMatches.map((match) => ({
      name: match[1].trim(),
      operator: match[2] === '^=' ? '^=' : match[2] === '=' ? '=' : 'exists',
      value: match[3] ?? match[4]
    }))
  };
}

function matchesSelector(element: FakeElement, selector: ParsedSelector): boolean {
  if (selector.tagName && element.tagName !== selector.tagName) {
    return false;
  }

  if (selector.classNames.length > 0) {
    const classes = new Set((element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
    for (const className of selector.classNames) {
      if (!classes.has(className)) {
        return false;
      }
    }
  }

  for (const attribute of selector.attributes) {
    const actual = element.getAttribute(attribute.name);
    if (attribute.operator === 'exists' && actual === null) {
      return false;
    }
    if (attribute.operator === '=' && actual !== attribute.value) {
      return false;
    }
    if (attribute.operator === '^=' && (actual === null || !actual.startsWith(attribute.value ?? ''))) {
      return false;
    }
  }

  return true;
}

function element(
  tagName: string,
  attributes: Record<string, string> = {},
  children: ChildNode[] = [],
  options?: { visible?: boolean }
): FakeElement {
  return new FakeElement(tagName, attributes, children, options);
}

function attendeeCard(index: number, name: string, title: string, company: string, email: string): FakeElement {
  return element(
    'article',
    {
      'data-grip-card-type': 'attendee',
      'data-person-external-id': `grip_attendee_${String(index).padStart(3, '0')}`,
      'data-attendee-name': name,
      'data-attendee-title': title,
      'data-company': company,
      'data-email': email
    },
    [
      element('h3', { 'data-field': 'name' }, [name]),
      element('div', { class: 'portal-meta' }, [
        element('span', { 'data-field': 'title' }, [title]),
        ' · ',
        element('span', { 'data-field': 'company' }, [company])
      ]),
      element('p', {}, [element('a', { 'data-field': 'email', href: `mailto:${email}` }, [email])])
    ]
  );
}

function speakerCard(name: string, title: string, company: string, email: string): FakeElement {
  return element(
    'article',
    {
      'data-grip-card-type': 'speaker',
      'data-speaker-name': name,
      'data-speaker-title': title,
      'data-speaker-company': company,
      'data-speaker-email': email
    },
    [
      element('h3', { 'data-field': 'speaker-name' }, [name]),
      element('div', { class: 'portal-meta' }, [
        element('span', { 'data-field': 'title' }, [title]),
        ' · ',
        element('span', { 'data-field': 'company' }, [company])
      ]),
      element('p', {}, [element('a', { href: `mailto:${email}` }, [email])])
    ]
  );
}

function sessionCard(
  externalKey: string,
  title: string,
  description: string,
  location: string,
  startsAt: string,
  endsAt: string,
  speakers: string[]
): FakeElement {
  return element(
    'article',
    {
      'data-grip-card-type': 'session',
      'data-session-external-id': externalKey,
      'data-session-title': title,
      'data-session-description': description,
      'data-location': location,
      'data-starts-at': startsAt,
      'data-ends-at': endsAt,
      'data-speakers': speakers.join('|')
    },
    [
      element('h3', { 'data-field': 'session-title' }, [title]),
      element('div', { class: 'portal-meta' }, [
        element('span', { 'data-field': 'location' }, [location]),
        ' · ',
        element('time', { 'data-field': 'time' }, [startsAt])
      ]),
      element('p', { 'data-field': 'session-description' }, [description]),
      element(
        'div',
        { class: 'pill-list' },
        speakers.map((speaker) => element('span', { class: 'speaker-pill', 'data-speaker-name': speaker }, [speaker]))
      )
    ]
  );
}

function createAttendeeListDocument(): FakeDocument {
  return new FakeDocument('Grip demo — attendee search results', [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card' }, [
        element('h2', {}, ['Grip demo — attendee search results']),
        element('p', { class: 'muted' }, ['Visible attendee records for capture tests.'])
      ])
    ]),
    element('div', { class: 'portal-list' }, [
      attendeeCard(1, 'Avery Chen', 'VP Partnerships', 'SignalWorks', 'avery@signalworks.io'),
      attendeeCard(2, 'Jordan Kim', 'Head of Revenue Operations', 'Northstar Bio', 'jordan@northstarbio.com')
    ])
  ]);
}

function createAttendeeProfileDocument(): FakeDocument {
  return new FakeDocument('Grip demo — attendee profile', [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card', 'data-grip-page': 'attendee-profile' }, [
        element('h2', {}, ['Grip demo — attendee profile'])
      ])
    ]),
    attendeeCard(1, 'Avery Chen', 'VP Partnerships', 'SignalWorks', 'avery@signalworks.io')
  ]);
}

function createSessionListDocument(): FakeDocument {
  return new FakeDocument('Grip demo — session list', [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card' }, [element('h2', {}, ['Grip demo — session list'])])
    ]),
    element('div', { class: 'portal-list' }, [
      sessionCard(
        'grip_session_001',
        'How AI Changes Event ROI',
        'Turning conference interactions into measurable pipeline faster.',
        'Main Stage',
        '2026-05-18T15:00:00.000Z',
        '2026-05-18T15:45:00.000Z',
        ['Leo Rossi', 'Avery Chen']
      ),
      sessionCard(
        'grip_session_002',
        'RevOps at Conferences',
        'Operational systems that turn event activity into clean follow-up.',
        'Room 2A',
        '2026-05-18T17:00:00.000Z',
        '2026-05-18T17:45:00.000Z',
        ['Jordan Kim', 'Maya Thompson']
      )
    ])
  ]);
}

function createSessionProfileDocument(): FakeDocument {
  return new FakeDocument('Grip demo — session detail', [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card' }, [element('h2', {}, ['Grip demo — session detail'])])
    ]),
    sessionCard(
      'grip_session_001',
      'How AI Changes Event ROI',
      'Turning conference interactions into measurable pipeline faster.',
      'Main Stage',
      '2026-05-18T15:00:00.000Z',
      '2026-05-18T15:45:00.000Z',
      ['Leo Rossi', 'Avery Chen']
    )
  ]);
}

function createSpeakerListDocument(): FakeDocument {
  return new FakeDocument('Grip demo — speaker list', [
    element('div', { class: 'portal-list' }, [
      speakerCard('Priya Patel', 'Director of Data Platforms', 'Altitude Cloud', 'priya@altitudecloud.com'),
      speakerCard('Sofia Martinez', 'Principal Product Marketing Manager', 'ApexGrid', 'sofia@apexgrid.com')
    ])
  ]);
}

function createPartialAttendeeDocument(): FakeDocument {
  return new FakeDocument('Grip demo — attendee profile', [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card', 'data-grip-page': 'attendee-profile' }, [
        element('h2', {}, ['Grip demo — attendee profile'])
      ])
    ]),
    element(
      'article',
      {
        'data-grip-card-type': 'attendee',
        'data-person-external-id': 'grip_attendee_partial',
        'data-attendee-name': 'Morgan Lee'
      },
      [element('h3', { 'data-field': 'name' }, ['Morgan Lee'])]
    )
  ]);
}

function installComputedStyleMock(): () => void {
  const original = globalThis.getComputedStyle;

  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value: (element: FakeElement) =>
      ({
        visibility: element.visible ? 'visible' : 'hidden',
        display: element.visible ? 'block' : 'none',
        position: 'static'
      }) satisfies Partial<CSSStyleDeclaration>
  });

  return () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: original
    });
  };
}

function runTests(): void {
  const restore = installComputedStyleMock();

  try {
    {
      const document = createAttendeeListDocument() as unknown as Document;
      const capture = extractGripVisiblePage(document, {
        pageUrl: 'https://example.com/demo/grip/attendees',
        capturedAt: '2026-03-31T12:00:00.000Z'
      });

      assert.equal(detectGripPageType(document, { pageUrl: 'https://example.com/demo/grip/attendees' }), 'ATTENDEE_LIST');
      assert.equal(capture.pageType, 'ATTENDEE_LIST');
      assert.equal(capture.records.length, 2);
      assert.equal(capture.pageTextSummary.includes('Avery Chen'), true);
      assert.equal(capture.capturedAt, '2026-03-31T12:00:00.000Z');
    }

    {
      const document = createAttendeeProfileDocument() as unknown as Document;
      const capture = extractGripVisiblePage(document, {
        pageUrl: 'https://example.com/demo/grip/attendees/avery-chen'
      });

      assert.equal(capture.pageType, 'ATTENDEE_PROFILE');
      assert.equal(capture.records.length, 1);
      assert.equal(capture.records[0]?.entityType, 'PERSON');
      assert.equal(capture.records[0]?.fields.fullName, 'Avery Chen');
    }

    {
      const document = createSessionListDocument() as unknown as Document;
      const capture = extractGripVisiblePage(document, {
        pageUrl: 'https://example.com/demo/grip/sessions'
      });

      assert.equal(capture.pageType, 'SESSION_LIST');
      assert.equal(capture.records.filter((record) => record.entityType === 'SESSION').length, 2);
      assert.equal(capture.records.filter((record) => record.entityType === 'PERSON').length, 4);
      assert.equal(capture.pageTextSummary.includes('How AI Changes Event ROI'), true);
    }

    {
      const document = createSessionProfileDocument() as unknown as Document;
      const capture = extractGripVisiblePage(document, {
        pageUrl: 'https://example.com/demo/grip/sessions/how-ai-changes-event-roi'
      });

      assert.equal(capture.pageType, 'SESSION_PROFILE');
      assert.equal(capture.records.filter((record) => record.entityType === 'SESSION').length, 1);
      assert.equal(capture.records.filter((record) => record.entityType === 'PERSON').length, 2);
    }

    {
      const document = createSpeakerListDocument() as unknown as Document;
      const capture = extractGripVisiblePage(document, {
        pageUrl: 'https://example.com/demo/grip/speakers'
      });

      assert.equal(capture.pageType, 'SPEAKER_LIST');
      assert.equal(capture.records.length, 2);
      assert.equal(capture.records.every((record) => record.entityType === 'PERSON'), true);
      assert.equal(capture.records.every((record) => record.fields.isSpeaker === true), true);
    }

    {
      const document = createPartialAttendeeDocument() as unknown as Document;
      const capture = extractGripVisiblePage(document, {
        pageUrl: 'https://example.com/demo/grip/attendees/morgan-lee'
      });

      assert.equal(capture.pageType, 'ATTENDEE_PROFILE');
      assert.equal(capture.records.length, 1);
      assert.equal(capture.records[0]?.fields.fullName, 'Morgan Lee');
      assert.equal(capture.records[0]?.fields.title, undefined);
      assert.equal(capture.pageTextSummary.includes('Morgan Lee'), true);
    }

    console.log('Extractor tests passed.');
  } finally {
    restore();
  }
}

runTests();
