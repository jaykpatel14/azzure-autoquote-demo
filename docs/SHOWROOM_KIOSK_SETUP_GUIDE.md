# Azzure AI Quote — Showroom Kiosk & Android TV Setup Guide

This guide walks jewelers through setting up an in-store touchscreen display (e.g. 32" Android 15 FHD touchscreen TV on wheels or tablet) using **Fully Kiosk Browser** in locked kiosk mode with automatic device pairing and staff lookup mode.

---

## Prerequisites & Target Hardware

- **Target Hardware:** 32" Android 15 FHD IPS touchscreen TV (EDLA-certified, Play Store access, WiFi) or Android tablet / iPad.
- **App:** Fully Kiosk Browser & Lockdown (available on Google Play Store).
- **Time required:** ~10 minutes.
- **Azzure AI Quote Plan:** Enterprise Plan (Showroom Mode enabled).

---

## Step-by-Step Kiosk Setup (~10 minutes)

### Step 1: Install Fully Kiosk Browser
1. Power on the Android TV / Tablet and connect it to your store's Wi-Fi network.
2. Open the **Google Play Store**.
3. Search for **"Fully Kiosk Browser & Lockdown"** and tap **Install**.
4. Launch the **Fully Kiosk** app.

---

### Step 2: Configure Start URL & Initial Registration
1. In your **Azzure AI Quote Dashboard**, go to **Settings → Showroom → Registered Devices** (or **Appearance & Theme**).
2. Copy your **Showroom Kiosk URL**:
   ```
   https://autoquote.everyfacets.com/showroom?token=[your-token]
   ```
3. In Fully Kiosk Browser settings on the TV, set **Web Navigation → Start URL** to your Showroom Kiosk URL.
4. Return to the browser. The screen will automatically load and display:
   > **"Setting up this kiosk"**
5. Enter a friendly name for this screen (e.g. `Front Entrance`, `VIP Lounge`, or `Counter Display 1`).
6. Tap **"Set up this kiosk →"**.
   - The device is now securely paired to your store account and will appear in your dashboard.

---

### Step 3: Enable Locked Kiosk Mode
1. Swipe from the left edge of the screen to open the **Fully Kiosk Settings** menu (or enter your Fully Kiosk Admin PIN if configured).
2. Navigate to **Kiosk Mode (Lock Task / Kiosk Lockdown)**:
   - **Enable Kiosk Mode**: Turn **ON**.
   - **Disable Status Bar**: Turn **ON** (prevents customers from pulling down notifications).
   - **Disable Navigation Bar**: Turn **ON** (prevents exiting via home/back buttons).

---

### Step 4: Configure the Screensaver / Attract Loop
1. In Fully Kiosk Settings, navigate to **Screensaver**:
   - **Screensaver URL**:
     ```
     https://autoquote.everyfacets.com/showroom/screensaver?token=[your-token]
     ```
   - **Screensaver Timer / Delay**: Set to **90 seconds** (1.5 minutes).
   - **Motion Detection / Touch to Exit**: Enable **Touch screen or camera motion to exit screensaver**.

---

### Step 5: Optimize Power & Reliability Settings
1. In Fully Kiosk Settings, navigate to **Power & Screen**:
   - **Keep Screen On**: Turn **ON** (or set a daily schedule for store hours).
   - **Screen Brightness**: 80%–100%.
2. In Fully Kiosk Settings, navigate to **Web Auto Reload**:
   - **Auto Reload on Network Reconnect**: Turn **ON**.
   - **Reload on Idle / Inactivity**: 90 seconds.

---

### Step 6: Verify in Jeweler Dashboard
1. Open your computer or phone and go to your **Azzure AI Quote Dashboard**:
   - **Settings → Showroom → Registered Devices** (`/settings/showroom?tab=devices`).
2. Verify that your new screen appears in the list with a **● Online** indicator (green dot).
3. You can rename or deactivate any device anytime from this dashboard.

---

## Staff PIN Access Mode (Sales Floor Lookup)

Store associates can look up any saved customer quote (e.g. `QT-4821`) directly on the kiosk without leaving the sales floor:

### 1. Setting Up Your Staff PIN
1. Log in to your personal account on the jeweler dashboard.
2. Go to **Settings → Profile** (`/settings/profile`).
3. Scroll to the **Kiosk Staff PIN** card.
4. Enter a personal 4-digit PIN (e.g. `5829`) and click **Save PIN**.

### 2. Using Staff Mode on the Kiosk
1. On the kiosk welcome screen, tap the discreet **"Staff Access"** button below the main CTA.
2. Enter your 4-digit PIN on the touch numpad.
3. Once verified, the kiosk displays the **Staff View**:
   - Search any quote by code (`QT-XXXX`).
   - View recent showroom quotes with photorealistic 3D renders and ring specs.
   - Selling prices are displayed; internal making costs and margin formulas are strictly protected and hidden.
4. Tap **"Exit staff mode"** or simply walk away — the kiosk automatically exits staff mode after **90 seconds of inactivity**.

---

## Troubleshooting & FAQ

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Kiosk displays "Setting up this kiosk" again after reboot** | Local storage / cache was wiped | Re-enter the device name and tap submit. The device token will persist across normal reboots. |
| **Device shows as "Offline" in dashboard** | No network connection or screen is asleep | Check Wi-Fi connection on the TV and verify "Keep Screen On" is enabled in Fully Kiosk settings. |
| **PIN entry shows "Locked for 5 minutes"** | 3 incorrect PIN attempts were entered | Wait 5 minutes for the lockout timer to expire, or verify your PIN in your user profile. |
| **Customer cannot exit staff mode** | Associate walked away while in staff view | The kiosk will automatically return to the customer welcome screen after 90 seconds of inactivity. |
| **Kiosk displays "Kiosk Inactive"** | Showroom token was deactivated in dashboard | Go to **Settings → Showroom** on your dashboard and click **Activate Showroom Kiosk**. |
