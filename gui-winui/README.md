# Space Analyzer Pro — WinUI 3 GUI

A modern Windows desktop app built with WinUI 3 (Windows App SDK) and Fluent Design.

## Prerequisites

- .NET 10.0 SDK
- Windows App SDK 2.4.0+
- Visual Studio 2022 17.8+ (or MSBuild CLI) — **VS MSBuild is required**; `dotnet build` fails with WMC9999 on non-English Windows.
- Rust toolchain (for the scanner backend)

## Quick Start

### 1. Build the Rust scanner

```bash
cargo build --release --bin space-analyzer-cli
```

Copy `target/release/space-analyzer-cli.exe` to the app's output directory, or set the path in Settings.

### 2. Build and run the WinUI 3 app

```powershell
# Use Visual Studio MSBuild (required for XAML compilation)
& "D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64

# Run
dotnet run --project SpaceAnalyzer
```

Or open `SpaceAnalyzer.sln` in Visual Studio and press **F5**.

### 3. Run tests (Rust workspace)

```bash
cargo test --workspace
```

## Architecture

```
gui-winui/
├── SpaceAnalyzer.sln
├── SpaceAnalyzer/
│   ├── SpaceAnalyzer.csproj   # .NET 10 + Windows App SDK 2.4.0
│   ├── App.xaml(.cs)          # Application entry
│   ├── MainWindow.xaml(.cs)   # NavigationView shell
│   ├── Helpers/
│   │   ├── ByteFormatter.cs   # Byte size formatting
│   │   ├── UiHelper.cs        # Folder picker, colors, MemoryStatusEx P/Invoke, OpenPath
│   │   └── Converters.cs      # BoolToVisibility / InverseBoolToVisibility / BoolToErrorBrush / BoolToScanButtonText
│   ├── Views/                 # Page XAML + code-behind
│   │   ├── DashboardPage
│   │   ├── ScanPage           # Stop button, path validation, errors, file type distribution, largest files with filter, export, deep/shallow/custom depth
│   │   ├── HistoryPage
│   │   ├── SmartSearchPage    # File/folder search by name + size
│   │   ├── WorkflowsPage      # Multi-step automation workflows (stub)
│   │   ├── AIAssistantPage    # Ollama chat interface
│   │   ├── DuplicatesPage
│   │   ├── SystemPage
│   │   ├── CleanupPage
│   │   ├── SettingsPage       # Theme, scanner path, Ollama config
│   │   └── AboutPage
│   ├── ViewModels/            # MVVM view models
│   ├── Services/
│   │   ├── ScannerService.cs  # Rust CLI interop (subprocess + JSON), StopScan, ExportScanResultAsync, process tracking
│   │   └── OllamaClient.cs    # Ollama REST API client
│   ├── Models/                # Data models
│   │   ├── FileTypeDistribution.cs  # Top-10 file type chart model
│   │   └── ...
│   └── Assets/                # Icons, images
```

## Interop with Rust

The WinUI 3 app calls the Rust scanner as a subprocess using subcommands:

```
space-analyzer-cli scan --path "C:\Users" --format json
space-analyzer-cli disk-info --path "C:\Users" --format json
space-analyzer-cli history --limit 50 --format json
space-analyzer-cli dedup --path "C:\Users" --format json
```

JSON output is deserialized into C# models in `Services/ScannerService.cs` using
`JsonNamingPolicy.SnakeCaseLower` + `JsonStringEnumConverter` (the Rust CLI and
`node_modules_cleaner` emit snake_case keys and string enums like `risk_level`).

> **`disk-info`** returns a **JSON array** of every mounted volume (the `--path` arg is
> accepted but ignored in JSON output), deserialized directly into `List<DiskVolume>`.
> Each entry has `mount_point`, `label`, `file_system`, `total_bytes`, `used_bytes`,
> `available_bytes`, `usage_percent` (empty `[]` when no volumes are detected; the C#
> model recomputes `UsedBytes`/`UsagePercent` from total/available).

## MVVM Pattern

Each page follows the MVVM pattern with `Page.DataContext` bound to a ViewModel instance named `VM`:

- **ViewModels** — expose `INotifyPropertyChanged` properties and async commands
- **Views** — XAML bindings via `x:Bind` (compiled bindings) where possible, `Binding` for runtime scenarios
- **Converter usage** — registered in `App.xaml` resources as `<helpers:BoolToVisibilityConverter x:Key="BoolToVisibility"/>`

## Design Language

- **Mica backdrop** on Windows 11, solid fallback on older Windows
- **Fluent Design** controls (NavigationView, InfoBar, CommandBar)
- **Dark/light theme** support (theme persistence is stored in Settings but requires manual application due to WinAppSDK limitations)
- **Responsive layout** with AdaptiveTrigger
- **Dashboard stat cards** — four hero cards (Total Files, Total Size, Scan Count, Duplicate Count) populated from scan history via `DashboardViewModel.LoadHeroStatsAsync()`
- **System monitors** — CPU, Memory, and Storage bars refresh every 3 seconds via `DispatcherTimer`

## Known Issues

- **Theme runtime switching is not applied** due to `Window.RequestedTheme` being unavailable in WinAppSDK 2.3. Theme preference is persisted in settings but applied on app restart.
- **WMC9999 XAML compiler error** occurs with `dotnet build` on non-English Windows. Use Visual Studio MSBuild instead: `D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64`.
- **WinUI MSBuild is required in-place**, not from a copy. Compiling `SpaceAnalyzer/` from a symlink or outside directory can produce unrelated source-not-found/XAML build errors; use the repo root as the working directory.

## Contributing

See the main project [README.md](https://github.com/ogneocortext/space-analyzer-pro/blob/main/README.md) and [AGENTS.md](AGENTS.md) for development conventions.
