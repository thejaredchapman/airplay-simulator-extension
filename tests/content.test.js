/**
 * Tests for AirPlay Simulator content script
 */

// Mock chrome API before requiring module
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Mock PresentationRequest
global.PresentationRequest = class PresentationRequest {
  constructor(urls) {
    this.urls = urls;
  }
  start() {
    return Promise.resolve({});
  }
};

const {
  findAllVideos,
  resolveVideoSource,
  createAirPlayButton,
  triggerAirPlay,
  showFallbackModal,
  scanForVideos,
} = require('../content.js');

// ─── Helpers ───────────────────────────────────────────────

function createVideo(src = 'https://example.com/video.mp4') {
  const video = document.createElement('video');
  video.src = src;
  // jsdom doesn't populate currentSrc automatically
  Object.defineProperty(video, 'currentSrc', { value: src, writable: true });
  return video;
}

function wrapVideoInContainer(video) {
  const container = document.createElement('div');
  container.appendChild(video);
  document.body.appendChild(container);
  return container;
}

beforeEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

// ─── findAllVideos ─────────────────────────────────────────

describe('findAllVideos', () => {
  test('finds videos in regular DOM', () => {
    const v1 = createVideo();
    const v2 = createVideo('https://example.com/other.mp4');
    document.body.appendChild(v1);
    document.body.appendChild(v2);

    const found = findAllVideos(document);
    expect(found).toHaveLength(2);
    expect(found).toContain(v1);
    expect(found).toContain(v2);
  });

  test('returns empty array when no videos exist', () => {
    const found = findAllVideos(document);
    expect(found).toHaveLength(0);
  });

  test('finds videos inside shadow DOM', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    video.src = 'https://example.com/shadow.mp4';
    shadow.appendChild(video);

    const found = findAllVideos(document);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(video);
  });

  test('finds videos in nested shadow DOMs', () => {
    const host1 = document.createElement('div');
    document.body.appendChild(host1);
    const shadow1 = host1.attachShadow({ mode: 'open' });

    const host2 = document.createElement('div');
    shadow1.appendChild(host2);
    const shadow2 = host2.attachShadow({ mode: 'open' });

    const video = document.createElement('video');
    video.src = 'https://example.com/nested.mp4';
    shadow2.appendChild(video);

    const found = findAllVideos(document);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(video);
  });

  test('finds videos in both regular DOM and shadow DOM', () => {
    const regularVideo = createVideo();
    document.body.appendChild(regularVideo);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const shadowVideo = document.createElement('video');
    shadowVideo.src = 'https://example.com/shadow.mp4';
    shadow.appendChild(shadowVideo);

    const found = findAllVideos(document);
    expect(found).toHaveLength(2);
  });
});

// ─── resolveVideoSource ───────────────────────────────────

describe('resolveVideoSource', () => {
  test('returns currentSrc for normal URLs', () => {
    const video = createVideo('https://example.com/video.mp4');
    expect(resolveVideoSource(video)).toBe('https://example.com/video.mp4');
  });

  test('skips blob URLs and tries <source> children', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', {
      value: 'blob:https://example.com/abc123',
      writable: true,
    });

    const source = document.createElement('source');
    source.src = 'https://cdn.example.com/real.mp4';
    video.appendChild(source);

    expect(resolveVideoSource(video)).toBe('https://cdn.example.com/real.mp4');
  });

  test('skips blob <source> tags too', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', {
      value: 'blob:https://example.com/abc',
      writable: true,
    });

    const source = document.createElement('source');
    source.src = 'blob:https://example.com/def';
    video.appendChild(source);

    // Falls back to currentSrc (blob) as last resort
    expect(resolveVideoSource(video)).toBe('blob:https://example.com/abc');
  });

  test('returns empty string when no source at all', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', { value: '', writable: true });
    expect(resolveVideoSource(video)).toBe('');
  });

  test('prefers first non-blob <source> when multiple exist', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', {
      value: 'blob:https://x.com/1',
      writable: true,
    });

    const s1 = document.createElement('source');
    s1.src = 'blob:https://x.com/2';
    video.appendChild(s1);

    const s2 = document.createElement('source');
    s2.src = 'https://cdn.example.com/good.mp4';
    video.appendChild(s2);

    expect(resolveVideoSource(video)).toBe('https://cdn.example.com/good.mp4');
  });
});

// ─── createAirPlayButton ──────────────────────────────────

describe('createAirPlayButton', () => {
  test('creates button inside video parent', () => {
    const video = createVideo();
    wrapVideoInContainer(video);

    createAirPlayButton(video);

    const btn = video.parentElement.querySelector('.airplay-sim-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('role')).toBe('button');
    expect(btn.getAttribute('aria-label')).toBe('Cast video');
  });

  test('sets data attribute to prevent duplicates', () => {
    const video = createVideo();
    wrapVideoInContainer(video);

    createAirPlayButton(video);
    expect(video.dataset.hasAirplayBtn).toBe('true');
  });

  test('does not create duplicate buttons', () => {
    const video = createVideo();
    wrapVideoInContainer(video);

    createAirPlayButton(video);
    createAirPlayButton(video);

    const buttons = video.parentElement.querySelectorAll('.airplay-sim-btn');
    expect(buttons).toHaveLength(1);
  });

  test('adds airplay-sim-container class to parent', () => {
    const video = createVideo();
    const container = wrapVideoInContainer(video);

    createAirPlayButton(video);

    expect(container.classList.contains('airplay-sim-container')).toBe(true);
  });

  test('sets parent to position relative', () => {
    const video = createVideo();
    const container = wrapVideoInContainer(video);

    createAirPlayButton(video);

    expect(container.style.position).toBe('relative');
  });

  test('does not crash if video has no parent', () => {
    const video = createVideo();
    // Video not in DOM — no parentElement
    expect(() => createAirPlayButton(video)).not.toThrow();
  });

  test('button contains SVG icon', () => {
    const video = createVideo();
    wrapVideoInContainer(video);

    createAirPlayButton(video);

    const btn = video.parentElement.querySelector('.airplay-sim-btn');
    const svg = btn.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  test('button has explicit white color', () => {
    const video = createVideo();
    wrapVideoInContainer(video);

    createAirPlayButton(video);

    const btn = video.parentElement.querySelector('.airplay-sim-btn');
    expect(btn.style.color).toBe('white');
  });
});

// ─── triggerAirPlay ───────────────────────────────────────

describe('triggerAirPlay', () => {
  test('uses Remote Playback API when available', async () => {
    const video = createVideo();
    const promptFn = jest.fn().mockResolvedValue(undefined);
    video.remote = { prompt: promptFn };

    await triggerAirPlay(video);

    expect(promptFn).toHaveBeenCalled();
  });

  test('falls back to Presentation API when Remote Playback fails', async () => {
    const video = createVideo();
    wrapVideoInContainer(video);
    video.remote = {
      prompt: jest.fn().mockRejectedValue(new Error('denied')),
    };

    const startFn = jest
      .fn()
      .mockRejectedValue(new Error('no screens'));
    global.PresentationRequest = class {
      constructor() {}
      start = startFn;
    };

    // Will also fail Presentation, then fall to WebKit (not present), then fallback modal
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    await triggerAirPlay(video);

    expect(video.remote.prompt).toHaveBeenCalled();
    expect(startFn).toHaveBeenCalled();
  });

  test('uses WebKit picker when available and others fail', async () => {
    const video = createVideo();
    wrapVideoInContainer(video);
    // No remote API
    delete video.remote;
    // No PresentationRequest
    delete global.PresentationRequest;

    video.webkitShowPlaybackTargetPicker = jest.fn();

    await triggerAirPlay(video);

    expect(video.webkitShowPlaybackTargetPicker).toHaveBeenCalled();

    // Restore
    global.PresentationRequest = class PresentationRequest {
      constructor(urls) {
        this.urls = urls;
      }
      start() {
        return Promise.resolve({});
      }
    };
  });

  test('shows fallback modal when all APIs fail', async () => {
    const video = createVideo();
    wrapVideoInContainer(video);
    delete video.remote;
    delete global.PresentationRequest;

    await triggerAirPlay(video);

    const modal = document.querySelector('.airplay-sim-modal');
    expect(modal).not.toBeNull();

    // Restore
    global.PresentationRequest = class PresentationRequest {
      constructor(urls) {
        this.urls = urls;
      }
      start() {
        return Promise.resolve({});
      }
    };
  });
});

// ─── showFallbackModal ────────────────────────────────────

describe('showFallbackModal', () => {
  test('creates modal with backdrop', () => {
    const video = createVideo();

    showFallbackModal(video);

    expect(document.querySelector('.airplay-sim-backdrop')).not.toBeNull();
    expect(document.querySelector('.airplay-sim-modal')).not.toBeNull();
  });

  test('modal has role=dialog', () => {
    const video = createVideo();

    showFallbackModal(video);

    const modal = document.querySelector('.airplay-sim-modal');
    expect(modal.getAttribute('role')).toBe('dialog');
  });

  test('input contains the video URL safely (no innerHTML injection)', () => {
    const src = 'https://example.com/video.mp4?x=<script>alert(1)</script>';
    const video = document.createElement('video');
    video.src = src;
    Object.defineProperty(video, 'currentSrc', { value: src, writable: true });

    showFallbackModal(video);

    const input = document.querySelector('.airplay-sim-modal input');
    expect(input.value).toBe(src);
    // Ensure no script tags ended up in the DOM as elements
    expect(document.querySelector('.airplay-sim-modal script')).toBeNull();
  });

  test('close button removes modal and backdrop', () => {
    const video = createVideo();

    showFallbackModal(video);

    const closeBtn = document.querySelector('.airplay-sim-close-btn');
    closeBtn.click();

    expect(document.querySelector('.airplay-sim-modal')).toBeNull();
    expect(document.querySelector('.airplay-sim-backdrop')).toBeNull();
  });

  test('clicking backdrop closes modal', () => {
    const video = createVideo();

    showFallbackModal(video);

    const backdrop = document.querySelector('.airplay-sim-backdrop');
    backdrop.click();

    expect(document.querySelector('.airplay-sim-modal')).toBeNull();
    expect(document.querySelector('.airplay-sim-backdrop')).toBeNull();
  });

  test('Escape key closes modal', () => {
    const video = createVideo();

    showFallbackModal(video);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.airplay-sim-modal')).toBeNull();
    expect(document.querySelector('.airplay-sim-backdrop')).toBeNull();
  });

  test('copy button copies URL to clipboard', async () => {
    const video = createVideo('https://example.com/video.mp4');

    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });

    showFallbackModal(video);

    const buttons = document.querySelectorAll('.airplay-sim-actions button');
    const copyBtn = buttons[0]; // First button is "Copy Link"
    copyBtn.click();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://example.com/video.mp4'
    );
    expect(copyBtn.textContent).toBe('Copied!');
  });

  test('open button opens URL in new tab', () => {
    const video = createVideo('https://example.com/video.mp4');

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});

    showFallbackModal(video);

    const buttons = document.querySelectorAll('.airplay-sim-actions button');
    const openBtn = buttons[1]; // Second button is "Open in New Tab"
    openBtn.click();

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/video.mp4',
      '_blank'
    );
  });

  test('alerts when no source URL found', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', { value: '', writable: true });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    showFallbackModal(video);

    expect(alertSpy).toHaveBeenCalledWith(
      'Could not find a usable video source URL to cast.'
    );
    expect(document.querySelector('.airplay-sim-modal')).toBeNull();
  });

  test('alerts when only blob URL available', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', {
      value: 'blob:https://example.com/abc',
      writable: true,
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    showFallbackModal(video);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('protected stream')
    );
    expect(document.querySelector('.airplay-sim-modal')).toBeNull();
  });

  test('multiple modals can coexist without ID conflicts', () => {
    const v1 = createVideo('https://example.com/v1.mp4');
    const v2 = createVideo('https://example.com/v2.mp4');

    showFallbackModal(v1);
    showFallbackModal(v2);

    const modals = document.querySelectorAll('.airplay-sim-modal');
    expect(modals).toHaveLength(2);

    // Both should have functional close buttons
    const closeBtns = document.querySelectorAll('.airplay-sim-close-btn');
    expect(closeBtns).toHaveLength(2);

    closeBtns[0].click();
    expect(document.querySelectorAll('.airplay-sim-modal')).toHaveLength(1);

    closeBtns[1].click();
    expect(document.querySelectorAll('.airplay-sim-modal')).toHaveLength(0);
  });
});

// ─── scanForVideos ────────────────────────────────────────

describe('scanForVideos', () => {
  test('attaches buttons to all existing videos', () => {
    const v1 = createVideo();
    const v2 = createVideo('https://example.com/other.mp4');
    wrapVideoInContainer(v1);
    wrapVideoInContainer(v2);

    scanForVideos();

    expect(v1.dataset.hasAirplayBtn).toBe('true');
    expect(v2.dataset.hasAirplayBtn).toBe('true');
  });

  test('handles pages with no videos gracefully', () => {
    expect(() => scanForVideos()).not.toThrow();
  });
});

// ─── Message listener ─────────────────────────────────────

describe('chrome.runtime.onMessage listener', () => {
  let listener;

  beforeEach(() => {
    // The listener was registered when we required the module
    listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
  });

  test('scan action returns video count', () => {
    const v1 = createVideo();
    const v2 = createVideo('https://example.com/other.mp4');
    wrapVideoInContainer(v1);
    wrapVideoInContainer(v2);

    const sendResponse = jest.fn();
    listener({ action: 'scan' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ count: 2 });
  });

  test('scan action returns 0 when no videos', () => {
    const sendResponse = jest.fn();
    listener({ action: 'scan' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ count: 0 });
  });

  test('fallback action shows modals for all videos', () => {
    const video = createVideo();
    wrapVideoInContainer(video);

    const sendResponse = jest.fn();
    listener({ action: 'fallback' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ status: 'shown' });
    expect(document.querySelector('.airplay-sim-modal')).not.toBeNull();
  });

  test('fallback action returns none when no videos', () => {
    const sendResponse = jest.fn();
    listener({ action: 'fallback' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ status: 'none' });
  });
});
