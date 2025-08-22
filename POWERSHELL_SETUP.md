# PowerShell 7 Setup Guide

## Current Status
- **Current Terminal**: Windows PowerShell 5.1
- **VS Code Default**: Now configured to use PowerShell as default terminal
- **PowerShell 7**: Not yet installed

## Install PowerShell 7

### Option 1: Using Windows Package Manager (Recommended)
```powershell
winget install Microsoft.PowerShell
```

### Option 2: Direct Download
1. Go to: https://github.com/PowerShell/PowerShell/releases
2. Download the latest `.msi` file for Windows
3. Run the installer

### Option 3: Using Chocolatey
```powershell
choco install powershell-core
```

## After Installation

Once PowerShell 7 is installed, update the VS Code settings in `.vscode/settings.json`:

```json
{
  "terminal.integrated.defaultProfile.windows": "PowerShell 7",
  "terminal.integrated.profiles.windows": {
    "PowerShell 7": {
      "path": "pwsh.exe",
      "source": "PowerShell",
      "args": ["-NoExit"],
      "icon": "terminal-powershell"
    },
    "PowerShell 5": {
      "source": "PowerShell",
      "icon": "terminal-powershell"
    },
    "Command Prompt": {
      "path": ["${env:windir}\\System32\\cmd.exe"],
      "args": [],
      "icon": "terminal-cmd"
    },
    "Git Bash": {
      "source": "Git Bash"
    }
  }
}
```

## Benefits of PowerShell 7
- ✅ Cross-platform compatibility
- ✅ Better performance
- ✅ Enhanced cmdlets and features
- ✅ Improved error handling
- ✅ Support for modern .NET features

## Current VS Code Configuration
The `.vscode/settings.json` file has been configured to:
- Set PowerShell as the default terminal
- Enable bypass execution policy for development
- Configure proper terminal profiles

## Verification
After installing PowerShell 7, verify the installation:
```powershell
pwsh --version
```

You should see something like: `PowerShell 7.x.x`
