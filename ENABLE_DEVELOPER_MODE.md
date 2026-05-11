# ⚠️ CRITICAL: Enable Windows Developer Mode

## Current Issue

The Flutter app **cannot run** because Windows Developer Mode is not enabled.

**Error:**
```
Building with plugins requires symlink support.
Please enable Developer Mode in your system settings.
```

## Why This Is Required

Flutter uses **symlinks** to manage plugin dependencies. Without Developer Mode:
- ❌ Cannot install Flutter plugins
- ❌ Cannot build the app
- ❌ Cannot run the app
- ❌ Cannot use ANY Flutter plugins (file_picker, secure_storage, etc.)

This is **NOT optional** - it's a hard requirement for Flutter development on Windows.

## Solution: Enable Developer Mode

### Method 1: Using Settings UI (Recommended)

1. **Open Windows Settings**
   - Press `Windows + I`
   - OR click Start → Settings

2. **Navigate to Developer Settings**
   - Click **Privacy & Security** (left sidebar)
   - Click **For developers**

3. **Enable Developer Mode**
   - Toggle **Developer Mode** to **ON**
   - Click **Yes** on the confirmation dialog

4. **Restart Your Computer** (recommended)

### Method 2: Using Command (Quick)

Run this command in PowerShell (as Administrator):
```powershell
start ms-settings:developers
```

Then toggle Developer Mode to ON.

### Method 3: Using Registry (Advanced)

Run PowerShell as Administrator:
```powershell
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /t REG_DWORD /f /v "AllowDevelopmentWithoutDevLicense" /d "1"
```

Then restart your computer.

## After Enabling Developer Mode

1. **Restart your terminal/IDE**

2. **Clean and rebuild**:
   ```bash
   cd file_vault_app
   flutter clean
   flutter pub get
   flutter run
   ```

3. **Verify it works**:
   ```bash
   flutter doctor -v
   ```

## What Developer Mode Enables

- ✅ Symlink creation (required for Flutter plugins)
- ✅ Sideloading apps
- ✅ Remote debugging
- ✅ Device Portal access
- ✅ Full development capabilities

## Security Note

Developer Mode is **safe** for development machines. It's designed for developers and is used by millions of Windows developers worldwide.

## Alternative: Use WSL2 or Linux

If you cannot enable Developer Mode (corporate policy, etc.):
- Use **WSL2** (Windows Subsystem for Linux)
- Use a **Linux VM**
- Use a **Mac** for Flutter development

## Current Status

- ❌ Developer Mode: **DISABLED**
- ❌ App Status: **CANNOT RUN**
- ⚠️ Share Target Feature: **TEMPORARILY DISABLED** (will be re-enabled after Developer Mode is enabled)

## Next Steps

1. **Enable Developer Mode** (see instructions above)
2. **Restart your computer**
3. **Run**: `flutter clean && flutter pub get`
4. **Uncomment share target code** (I'll help with this)
5. **Test the app**

---

**This is blocking ALL Flutter development on this machine.**
**Please enable Developer Mode to continue.**
