# AirPlay Simulator & Enabler

A simple Chrome Extension that adds an AirPlay-style button to HTML5 videos on any webpage. This allows you to easily cast videos to supported devices or extract the direct stream URL for use in other players.

## Features

- **Universal Button**: Automatically detects `<video>` elements on any page and adds a cast button.
- **Multiple Casting Methods**: Attempts to use:
    - **Remote Playback API** (Standard)
    - **Presentation API** (Chromecast)
    - **WebKit Playback Target Picker** (Safari/iOS)
- **Fallback Mode**: If native casting fails, it displays the direct video stream URL in a popup so you can copy/open it manually.
- **Popup Controls**: Manually re-scan the page for videos or force the fallback URL view.

---

## Installation (Developer Mode)

Since this extension is not yet on the Chrome Web Store, you can install it manually in developer mode:

1.  **Download/Clone the Code**:
    - Download the source code or clone this repository to a folder on your computer.
    - Ensure you have the folder unzipped if you downloaded a zip file.

2.  **Open Chrome Extensions**:
    - In Chrome, navigate to `chrome://extensions` (or click the puzzle piece icon -> Manage Extensions).

3.  **Enable Developer Mode**:
    - Toggle the **"Developer mode"** switch in the top right corner of the page.

4.  **Load Unpacked Extension**:
    - Click the **"Load unpacked"** button that appears in the top left.
    - Select the folder containing the extension files (`manifest.json`, etc.).

5.  **Done!**: The extension icon should appear in your toolbar.

---

## How to Use

1.  Navigate to any website with a video (e.g., YouTube, Vimeo, News sites).
2.  Look for the **AirPlay icon** (a rectangle with a triangle at the bottom) overlaid on the video player.
3.  Click the icon:
    - If a casting device is available, the browser will prompt you to select it.
    - If no device is found, a modal will appear with the **Direct Stream URL**. You can copy this link and open it in players like VLC or QuickTime.

**Troubleshooting:**
- If the button doesn't appear, click the extension icon in your toolbar and select **"Detect Videos"**.
- Some sites use complex video players that might hide standard HTML5 controls. Use the popup menu to force detection.

---

## Publishing to the Chrome Web Store

To share this extension with the world, follow these steps to publish it:

### Prerequisites
- A Google Account.
- A one-time **$5 registration fee** for a Chrome Web Store developer account.
- Screenshots and promotional images (1280x800, 440x280).
- A zipped file of your extension code.

### Steps
1.  **Zip Your Extension**:
    - Create a zip file containing ONLY the files inside the extension folder (`manifest.json`, `content.js`, `popup.html`, `icons/`, etc.). Do NOT include the parent folder itself.

2.  **Create Developer Account**:
    - Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/dev/dashboard).
    - Sign in and pay the registration fee if prompted.

3.  **Upload New Item**:
    - Click **"Add new item"**.
    - Upload your `.zip` file.

4.  **Fill Store Listing**:
    - **Title & Description**: Ensure these are clear and accurate.
    - **Category**: Likely "Productivity" or "Accessibility".
    - **Language**: English (or your target language).
    - **Icons/Images**: Upload your promotional screenshots.

5.  **Privacy Practices**:
    - Go to the **"Privacy"** tab.
    - Declare the permissions you use (`activeTab`, `scripting`, `host_permissions`).
    - Explain *why* you need them (e.g., "To inject the AirPlay button onto video players").
    - Since this extension does not collect user data, check the appropriate boxes.

6.  **Review & Publish**:
    - Click **"Submit for Review"**.
    - Google will review your extension (usually takes a few days).
    - Once approved, it will be live on the store!

---

## Development Info

This extension was created using **Manifest V3**.
- `manifest.json`: Configuration.
- `content.js`: Injects the UI into webpages.
- `background.js`: Handles event pages (currently minimal).
- `popup.html`/`js`: User interface for manual controls.
