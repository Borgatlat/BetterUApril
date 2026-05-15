# Android SDK setup (Windows) – fix "ANDROID_HOME" / "adb not recognized"

Expo needs the Android SDK and `adb` to run the Android app or emulator. If you see:

- **"Failed to resolve the Android SDK path"**
- **"'adb' is not recognized"**

do the following.

---

## Option A: Install Android Studio (recommended for emulator)

1. **Download and install Android Studio**  
   https://developer.android.com/studio

2. **First launch**  
   Use the standard setup and make sure **Android SDK** is installed. Note the SDK location (often `C:\Users\<YourUser>\AppData\Local\Android\Sdk`).

3. **Set environment variables**
   - Press **Win + R**, type `sysdm.cpl`, Enter.
   - **Advanced** tab → **Environment Variables**.
   - Under **User variables** (or **System variables**), click **New**:
     - **Variable name:** `ANDROID_HOME`
     - **Variable value:** your SDK path, e.g. `C:\Users\sborg\AppData\Local\Android\Sdk`
   - Edit **Path**, add:
     - `%ANDROID_HOME%\platform-tools`
   - Confirm with **OK** on all dialogs.

4. **Restart your terminal** (and Cursor/IDE if you run commands from there).

5. **Create an emulator (for simulation)**  
   In Android Studio: **Tools → Device Manager → Create Device**, pick a phone, then a system image (e.g. API 34), finish.

6. **Run the app**
   ```bash
   npx expo run:android
   ```
   If the emulator isn’t running, Expo will usually start it.

---

## Option B: Use the project script (after SDK is installed)

If the SDK is already installed but the terminal still doesn’t see it:

1. In **PowerShell**, from the project root:
   ```powershell
   . .\scripts\set-android-env.ps1
   ```
   (The leading dot runs the script in the current session so `ANDROID_HOME` and `PATH` apply.)

2. Then:
   ```bash
   npx expo run:android
   ```

This only affects the current PowerShell session. For a permanent fix, set `ANDROID_HOME` and `Path` as in Option A.
