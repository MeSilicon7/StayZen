# StayZen 🧘

Stay calm, stay focused. StayZen gently blocks noise from your digital world and helps you work in mindful, Pomodoro-powered bursts.

## ✨ Features

- **🚫 Site Blocker** — Block distracting websites with a calming "Focus Mode" message
- **🖼️ Image Blocker** — Hide images and background images to reduce visual noise
- **⏱️ Pomodoro Timer** — 25-minute focus sessions with 5-minute breaks
- **📊 Site Usage Tracker** — Get warnings when spending too much time on a site
- **📈 Daily Stats** — Track your focus time and productivity
- **🔔 Smart Notifications** — Alerts for Pomodoro sessions and time warnings

## 🚀 Installation

### Loading in Firefox (Temporary)

1. **Clone or download** this repository
2. Open Firefox and navigate to `about:debugging`
3. Click **"This Firefox"** in the left sidebar
4. Click **"Load Temporary Add-on"**
5. Navigate to the extension folder and select `manifest.json`
6. The extension icon should appear in your toolbar!

### Loading in Firefox (Permanent)

1. **Package the extension:**
   - Zip all files in the extension folder
   - Rename to `stayzen.xpi`

2. **Sign the extension** (required for permanent installation):
   - Visit [addons.mozilla.org](https://addons.mozilla.org/developers/)
   - Create a developer account
   - Submit your extension for signing

## 📖 Usage

### Pomodoro Timer
1. Click the StayZen icon in your toolbar
2. Click "Start" to begin a 25-minute focus session
3. Work until the timer ends
4. Take a 5-minute break when prompted
5. Repeat!

### Blocking Sites
1. Open the popup
2. Enter a domain (e.g., `facebook.com`, `twitter.com`)
3. Click "Add"
4. Visit the site to see the Focus Mode message

### Image Blocking
1. Toggle "Block Images" in the popup
2. All images will be hidden on current and future pages
3. Toggle off to show images again

### Stats
- View your daily focus time in the popup
- See how many sites you've blocked today
- Stats reset every day at midnight

## 🛠️ Technical Details

- **Manifest Version:** V3 (Firefox 109+)
- **Permissions:** `storage`, `tabs`, `activeTab`, `notifications`, `webRequest`
- **APIs Used:** `browser.storage.local`, `browser.tabs`, `browser.notifications`
- **No Build Tools Required:** Pure HTML/CSS/JavaScript

## 📁 Project Structure
