// AirPlay Simulator Content Script

// Function to create the AirPlay button
function createAirPlayButton(videoElement) {
  // Check if button already exists for this video
  if (videoElement.dataset.hasAirplayBtn) return;

  const btn = document.createElement('div');
  btn.className = 'airplay-sim-btn';
  btn.title = 'AirPlay / Cast Video';

  // Apple AirPlay Icon SVG
  btn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 17H3V5H21V17H18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19L16 15H8L12 19Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;

  // Style helper for positioning
  videoElement.parentElement.style.position = 'relative';

  // Append to parent container (usually works best)
  // Sometimes video is wrapped in a player div; try to find nearest relative container
  let container = videoElement.parentElement;

  container.appendChild(btn);
  videoElement.dataset.hasAirplayBtn = 'true';

  // Click handler
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    triggerAirPlay(videoElement);
  });
}

// Main function to trigger casting
async function triggerAirPlay(video) {
  console.log('AirPlay Simulator: Attempting to cast video...', video);

  // Method 1: Remote Playback API (Standard for AirPlay/Cast)
  if (video.remote && typeof video.remote.watch === 'function') {
    try {
      // Prompt user to select device
      await video.remote.prompt();
      return;
    } catch (err) {
      console.warn('Remote Playback API failed:', err);
    }
  }

  // Method 2: Presentation API (Chromecast default)
  if (navigator.presentation && navigator.presentation.defaultRequest) {
      try {
          const connection = await navigator.presentation.defaultRequest.start();
          // Send video URL if possible (complex implementation required here usually)
          console.log('Presentation API connected:', connection);
          return;
      } catch (err) {
          console.warn('Presentation API failed:', err);
      }
  }

  // Method 3: WebKit specific (Safari/iOS legacy)
  if (video.webkitShowPlaybackTargetPicker) {
    try {
      video.webkitShowPlaybackTargetPicker();
      return;
    } catch (err) {
      console.warn('WebKit Picker failed:', err);
    }
  }

  // Method 4: Fallback Simulation (Show Source URL)
  showFallbackModal(video);
}

function showFallbackModal(video) {
  const src = video.currentSrc || video.src;

  if (!src) {
    alert('Could not find video source URL to cast.');
    return;
  }

  // Create a modal to show the link or open it
  const modal = document.createElement('div');
  modal.className = 'airplay-sim-modal';
  modal.innerHTML = `
    <div class="airplay-sim-content">
      <h3>AirPlay Simulation</h3>
      <p>Native casting not available. Use the direct link below on your target device:</p>
      <input type="text" value="${src}" readonly />
      <div class="airplay-sim-actions">
        <button id="aps-copy">Copy Link</button>
        <button id="aps-open">Open in New Tab</button>
        <button id="aps-close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('aps-copy').onclick = () => {
    navigator.clipboard.writeText(src);
    document.getElementById('aps-copy').textContent = 'Copied!';
  };

  document.getElementById('aps-open').onclick = () => {
    window.open(src, '_blank');
  };

  document.getElementById('aps-close').onclick = () => {
    modal.remove();
  };
}

// Observer to detect new videos added to DOM
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'VIDEO') {
          createAirPlayButton(node);
        } else if (node.querySelectorAll) {
          const videos = node.querySelectorAll('video');
          videos.forEach(createAirPlayButton);
        }
      });
    }
  });
});

// Initial scan
function scanForVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(createAirPlayButton);
}

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForVideos);
} else {
    scanForVideos();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    scanForVideos();
    const count = document.querySelectorAll('video').length;
    sendResponse({ count: count });
  } else if (request.action === 'fallback') {
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      videos.forEach(v => showFallbackModal(v));
      sendResponse({ status: 'shown' });
    } else {
      sendResponse({ status: 'none' });
    }
  }
});
