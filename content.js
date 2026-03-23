// AirPlay Simulator Content Script

let idCounter = 0;

// Traverse shadow DOMs to find all <video> elements
function findAllVideos(root = document) {
  const videos = [];
  videos.push(...root.querySelectorAll('video'));

  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) {
      videos.push(...findAllVideos(el.shadowRoot));
    }
  });

  return videos;
}

// Resolve the best usable source URL from a video element
function resolveVideoSource(video) {
  const src = video.currentSrc || video.src;

  // Skip blob: URLs — they are useless outside the current page context
  if (src && !src.startsWith('blob:')) {
    return src;
  }

  // Try <source> children for a real URL
  const sources = video.querySelectorAll('source');
  for (const source of sources) {
    if (source.src && !source.src.startsWith('blob:')) {
      return source.src;
    }
  }

  // Last resort: return whatever we have (may be blob or empty)
  return src || '';
}

// Create the AirPlay button for a video element
function createAirPlayButton(videoElement) {
  if (videoElement.dataset.hasAirplayBtn) return;

  const btn = document.createElement('div');
  btn.className = 'airplay-sim-btn';
  btn.title = 'AirPlay / Cast Video';
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Cast video');
  btn.style.color = 'white';

  // Apple AirPlay Icon SVG
  btn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 17H3V5H21V17H18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19L16 15H8L12 19Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;

  let container = videoElement.parentElement;
  if (!container) return;

  container.style.position = 'relative';
  container.classList.add('airplay-sim-container');
  container.appendChild(btn);
  videoElement.dataset.hasAirplayBtn = 'true';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    triggerAirPlay(videoElement);
  });
}

// Main function to trigger casting
async function triggerAirPlay(video) {
  // Method 1: Remote Playback API (standard for AirPlay/Cast)
  if (video.remote && typeof video.remote.prompt === 'function') {
    try {
      await video.remote.prompt();
      return;
    } catch (err) {
      console.warn('AirPlay Simulator: Remote Playback API failed:', err);
    }
  }

  // Method 2: Presentation API — create a proper request
  if (typeof PresentationRequest !== 'undefined') {
    const src = resolveVideoSource(video);
    if (src) {
      try {
        const request = new PresentationRequest([src]);
        await request.start();
        return;
      } catch (err) {
        console.warn('AirPlay Simulator: Presentation API failed:', err);
      }
    }
  }

  // Method 3: WebKit specific (Safari/iOS)
  if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
    try {
      video.webkitShowPlaybackTargetPicker();
      return;
    } catch (err) {
      console.warn('AirPlay Simulator: WebKit Picker failed:', err);
    }
  }

  // Method 4: Fallback modal
  showFallbackModal(video);
}

function showFallbackModal(video) {
  const src = resolveVideoSource(video);

  if (!src) {
    showFallbackModal._lastNoSourceAlert = true;
    alert('Could not find a usable video source URL to cast.');
    return;
  }

  if (src.startsWith('blob:')) {
    showFallbackModal._lastBlobAlert = true;
    alert(
      'This video uses a protected stream (blob URL) that cannot be cast directly. ' +
      'Try using the native casting feature of your browser or device instead.'
    );
    return;
  }

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'airplay-sim-backdrop';

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'airplay-sim-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'AirPlay Simulation');

  const heading = document.createElement('h3');
  heading.textContent = 'AirPlay Simulation';

  const description = document.createElement('p');
  description.textContent =
    'Native casting not available. Use the direct link below on your target device:';

  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.value = src; // Safe: setAttribute/value, no innerHTML

  const actions = document.createElement('div');
  actions.className = 'airplay-sim-actions';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy Link';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(src);
    copyBtn.textContent = 'Copied!';
  });

  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open in New Tab';
  openBtn.addEventListener('click', () => {
    window.open(src, '_blank');
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'airplay-sim-close-btn';

  function closeModal() {
    backdrop.remove();
    modal.remove();
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', onEsc);

  actions.appendChild(copyBtn);
  actions.appendChild(openBtn);
  actions.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'airplay-sim-content';
  content.appendChild(heading);
  content.appendChild(description);
  content.appendChild(input);
  content.appendChild(actions);

  modal.appendChild(content);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

// Observer to detect new videos added to DOM (including shadow DOM)
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      if (node.nodeName === 'VIDEO') {
        createAirPlayButton(node);
      } else if (node.querySelectorAll) {
        findAllVideos(node).forEach(createAirPlayButton);
      }
    }
  }
});

// Scan for all videos including those in shadow DOMs
function scanForVideos() {
  findAllVideos(document).forEach(createAirPlayButton);
}

// Start observing
function startObserver() {
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// SPA navigation handling
function setupSPAListeners() {
  let lastUrl = location.href;

  // Listen for History API changes (pushState/replaceState)
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    onNavigate();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    onNavigate();
  };

  window.addEventListener('popstate', onNavigate);
  window.addEventListener('hashchange', onNavigate);

  function onNavigate() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Small delay to let the new page content render
      setTimeout(scanForVideos, 500);
    }
  }
}

// Initialize
function init() {
  scanForVideos();
  startObserver();
  setupSPAListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    scanForVideos();
    const count = findAllVideos(document).length;
    sendResponse({ count });
  } else if (request.action === 'fallback') {
    const videos = findAllVideos(document);
    if (videos.length > 0) {
      videos.forEach((v) => showFallbackModal(v));
      sendResponse({ status: 'shown' });
    } else {
      sendResponse({ status: 'none' });
    }
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    findAllVideos,
    resolveVideoSource,
    createAirPlayButton,
    triggerAirPlay,
    showFallbackModal,
    scanForVideos,
  };
}
