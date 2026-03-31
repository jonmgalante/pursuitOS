import {
  DEMO_GRIP_ATTENDEE_LIST_DESCRIPTION,
  DEMO_GRIP_ATTENDEE_LIST_PAGE_TITLE,
  DEMO_GRIP_SESSION_LIST_PAGE_TITLE,
  listDemoGripAttendeeCardFixtures,
  listDemoGripSessionCardFixtures
} from '../../lib/demo-grip-fixtures';

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
    this.documentElement = new FakeElement('html', {}, [new FakeElement('body', {}, bodyChildren)]);
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
      name: (match[1] ?? '').trim(),
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

export function createDemoGripAttendeeListDocument(): Document {
  const attendeeCards = listDemoGripAttendeeCardFixtures().map((attendee) =>
    element(
      'article',
      {
        class: 'portal-card',
        ...attendee.dataAttributes
      },
      [
        element('h3', { 'data-field': 'name' }, [attendee.fullName]),
        element('div', { class: 'portal-meta' }, [
          element('span', { 'data-field': 'title' }, [attendee.title]),
          ' · ',
          element('span', { 'data-field': 'company' }, [attendee.companyName])
        ]),
        element('p', {}, [
          element('a', { 'data-field': 'email', href: `mailto:${attendee.email}` }, [attendee.email])
        ]),
        element(
          'div',
          { class: 'pill-list' },
          attendee.pills.map((pill) => element('span', { class: 'pill' }, [pill]))
        )
      ]
    )
  );

  return new FakeDocument(DEMO_GRIP_ATTENDEE_LIST_PAGE_TITLE, [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card' }, [
        element('h2', {}, [DEMO_GRIP_ATTENDEE_LIST_PAGE_TITLE]),
        element('p', { class: 'muted' }, [DEMO_GRIP_ATTENDEE_LIST_DESCRIPTION])
      ])
    ]),
    element('div', { class: 'portal-list' }, attendeeCards)
  ]) as unknown as Document;
}

export function createDemoGripSessionListDocument(): Document {
  const sessionCards = listDemoGripSessionCardFixtures().map((session) =>
    element(
      'article',
      {
        class: 'portal-card',
        ...session.dataAttributes
      },
      [
        element('h3', { 'data-field': 'session-title' }, [session.title]),
        element('div', { class: 'portal-meta' }, [
          element('span', { 'data-field': 'location' }, [session.location]),
          ' · ',
          element('time', { 'data-field': 'time' }, [session.startsAtLabel])
        ]),
        element('p', { 'data-field': 'session-description' }, [session.description]),
        element(
          'div',
          { class: 'pill-list' },
          session.speakers.map((speaker) =>
            element('span', { class: 'pill', 'data-speaker-name': speaker.fullName }, [speaker.fullName])
          )
        )
      ]
    )
  );

  return new FakeDocument(DEMO_GRIP_SESSION_LIST_PAGE_TITLE, [
    element('div', { class: 'demo-toolbar' }, [
      element('div', { class: 'card' }, [element('h2', {}, [DEMO_GRIP_SESSION_LIST_PAGE_TITLE])])
    ]),
    element('div', { class: 'portal-list' }, sessionCards)
  ]) as unknown as Document;
}

export function installComputedStyleMock(): () => void {
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
