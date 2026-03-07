# How the AirPlay Simulator Extension Was Created

This document outlines the technical decisions and development process for the AirPlay Simulator Chrome Extension.

## 1. Project Structure & Manifest V3
The extension was built using **Manifest V3**, the latest standard for Chrome extensions.
- **`manifest.json`**: This is the configuration file. We defined the `manifest_version` as 3.
- **Permissions**: We requested:
    - `activeTab`: To allow the extension to interact with the current tab when clicked.
    - `scripting`: To inject scripts/styles programmatically if needed (though we primarily use `content_scripts`).
    - `host_permissions` for `<all_urls>`: To ensure the content script can run on any website with a video.

## 2. Content Script (`content.js`)
The core logic lives here. This script runs on every page load.
- **Video Detection**: It uses a `MutationObserver` to watch the DOM for changes. This ensures that if a website loads a video dynamically (like in a Single Page Application), our extension detects it.
- **Button Injection**: For every `<video>` element found, we create a custom HTML button (`div.airplay-sim-btn`) and append it to the video's parent container.
- **Event Handling**: When clicked, the button triggers the `triggerAirPlay` function.

## 3. The Casting Logic
We implemented a "waterfall" strategy to attempt casting:
1.  **Remote Playback API**: The modern standard (`video.remote.watch`).
2.  **Presentation API**: The standard used by Chromecast (`navigator.presentation`).
3.  **WebKit Playback Target Picker**: Specific to Safari/iOS devices (`video.webkitShowPlaybackTargetPicker`).
4.  **Fallback Modal**: If all else fails, we display a custom modal with the direct video source URL (`src`). This allows the user to copy the link and manually cast it using other tools or open it in a compatible player (like VLC).

## 4. Popup & Interaction (`popup.html` / `popup.js`)
We added a browser action popup to give the user manual control.
- **Message Passing**: The popup sends messages (`chrome.tabs.sendMessage`) to the content script running on the page.
- **Actions**:
    - "Detect Videos": Forces a re-scan of the page in case the automatic observer missed something.
    - "Show Stream URLs": Manually triggers the fallback modal for all videos on the page.

## 5. Styling (`styles.css`)
We used CSS injection to style the button and the modal.
- **High Z-Index**: We used a very high `z-index` to ensure our UI elements appear on top of the website's native video player controls.
- **Isolation**: We tried to keep styles specific to avoid breaking the host website's layout.
