# Space Analyzer Pro — WinUI 3 GUI

A modern Windows desktop app built with WinUI 3 (Windows App SDK) and Fluent Design.

## Prerequisites

- .NET 8.0 SDK
- Windows App SDK 1.7+
- Visual Studio 2022 17.8+ (or `dotnet` CLI)
- Rust toolchain (for the scanner backend)

## Quick Start

### 1. Build the Rust scanner

```bash
cargo build --release --bin space-analyzer-pro
```

Copy `target/release/space-analyzer-pro.exe` to the app's output directory, or set the path in Settings.

### 2. Build and run the WinUI 3 app

```bash
cd gui-winui
dotnet build -c Debug
dotnet run --project SpaceAnalyzer
```

Or open `SpaceAnalyzer.sln` in Visual Studio and press F5.

## Architecture

```
gui-winui/
├── SpaceAnalyzer.sln
├── SpaceAnalyzer/
│   ├── App.xaml(.cs)           — Application entry
│   ├── MainWindow.xaml(.cs)    — NavigationView shell
│   ├── Views/                  — Page XAML + code-behind
│   │   ├── DashboardPage
│   │   ├── ScanPage
│   │   ├── HistoryPage
│   │   ├── SmartSearchPage
│   │   ├── WorkflowsPage
│   │   ├── AIAssistantPage
│   │   ├── DuplicatesPage
│   │   ├── SystemPage
│   │   └── SettingsPage
│   ├── ViewModels/             — MVVM view models
│   ├── Services/
│   │   └── ScannerService.cs   — Rust CLI interop
│   ├── Models/                 — Data models
│   └── Assets/                 — Icons, images
```

## Interop with Rust

The WinUI 3 app calls the Rust scanner as a subprocess:

```
space-analyzer-pro scan --path "C:\Users" --format json
```

JSON output is deserialized into C# models in `Services/ScannerService.cs`.

## Design Language

- **Mica backdrop** on Windows 11, solid fallback on older Windows
- **Fluent Design** controls (NavigationView, InfoBar, CommandBar)
- **Dark/light theme** support via `RequestedTheme`
- **Responsive layout** with AdaptiveTrigger
