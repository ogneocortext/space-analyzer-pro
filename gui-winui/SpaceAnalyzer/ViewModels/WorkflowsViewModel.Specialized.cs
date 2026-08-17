// Licensed under the MIT License.
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using SpaceAnalyzer.Helpers;
using SpaceAnalyzer.Models;
using SpaceAnalyzer.Services;
using SpaceAnalyzer.Settings;

namespace SpaceAnalyzer.ViewModels;

public partial class WorkflowsViewModel
{
        private async Task RunPredictStorageAsync()
        {
            try
            {
                StoragePrediction? pred = null;
                if (_scanner.IsAvailable)
                {
                    try { pred = await _scanner.GetStorageForecastAsync(30, _cts.Token); }
                    catch (Exception ex) { StatusMessage = $"Forecast error: {ex.Message}. Using local heuristic."; }
                }
                if (pred is null)
                {
                    var hist = await _scanner.GetScanHistoryAsync(50, _cts.Token);
                    if (hist.Count >= 2) pred = AnalysisEngine.PredictStorage(hist, 30);
                }
                if (pred is null)
                {
                    OnUi(() =>
                    {
                        ReportTitle = "Storage Forecast";
                        Report = "Not enough scan history to forecast. Run at least two scans first.";
                    });
                    return;
                }
                var captured = pred;
                OnUi(() =>
                {
                    ReportTitle = "Storage Forecast (next 30 days)";
                    var sb = new System.Text.StringBuilder();
                    sb.AppendLine($"Current size:  {captured.CurrentSizeDisplay}");
                    sb.AppendLine($"Predicted:     {captured.PredictedSizeDisplay}");
                    sb.AppendLine($"Growth rate:   {captured.GrowthRateDisplay}");
                    sb.AppendLine($"Based on:      {captured.ScansUsed} scan(s)");
                    if (!captured.HasEnoughData)
                        sb.AppendLine("\nNote: fewer than 2 scans — projection is a rough estimate.");
                    Report = sb.ToString();
                });
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                OnUi(() => { ReportTitle = "Storage Forecast"; Report = $"Error: {ex.Message}"; });
            }
        }

        private async Task RunGenerateRecommendationsAsync()
        {
            try
            {
                var history = await _scanner.GetScanHistoryAsync(1, _cts.Token);
                var latest = history.FirstOrDefault();
                if (latest is null)
                {
                    OnUi(() => { ReportTitle = "Cleanup Recommendations"; Report = "No scan history available. Run a scan first."; });
                    return;
                }
                List<Recommendation> recs;
                if (_scanner.IsAvailable)
                {
                    try
                    {
                        recs = await _scanner.GetRecommendationsAsync(latest.Id, _cts.Token)
                            ?? AnalysisEngine.GetRecommendations(latest);
                    }
                    catch (Exception ex)
                    {
                        StatusMessage = $"Recommendations error: {ex.Message}. Using local heuristic.";
                        recs = AnalysisEngine.GetRecommendations(latest);
                    }
                }
                else
                {
                    recs = AnalysisEngine.GetRecommendations(latest);
                }
                string report;
                if (recs.Count == 0)
                {
                    report = "No cleanup recommendations for the latest scan.";
                }
                else
                {
                    var sb = new System.Text.StringBuilder();
                    foreach (var r in recs)
                    {
                        sb.AppendLine($"[{r.PriorityLabel}] {r.Title}");
                        sb.AppendLine($"    {r.Detail}");
                        if (r.HasSavings) sb.AppendLine($"    Est. savings: {r.EstimatedSavingsDisplay}");
                        sb.AppendLine();
                    }
                    report = sb.ToString();
                }
                OnUi(() =>
                {
                    ReportTitle = "Cleanup Recommendations";
                    Report = report;
                });
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                OnUi(() => { ReportTitle = "Cleanup Recommendations"; Report = $"Error: {ex.Message}"; });
            }
        }

        private async Task RunExportAsync()
        {
            if (_results.Count == 0)
            {
                OnUi(() => { ReportTitle = "Export"; Report = "No results to export. Run a file-finding workflow first."; });
                return;
            }
            try
            {
                var downloads = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                Directory.CreateDirectory(downloads);
                var file = System.IO.Path.Combine(downloads, $"workflow-results-{DateTime.Now:yyyyMMdd-HHmmss}.json");
                var dto = _results.Select(r => new
                {
                    path = r.Path,
                    name = r.Name,
                    sizeBytes = r.SizeBytes,
                    sizeDisplay = r.SizeDisplay
                });
                var options = new JsonSerializerOptions { WriteIndented = true };
                await File.WriteAllTextAsync(file, JsonSerializer.Serialize(dto, options), _cts.Token);
                OnUi(() =>
                {
                    ReportTitle = "Export";
                    Report = $"Exported {_results.Count} result(s) to:{Environment.NewLine}{file}";
                });
            }
            catch (Exception ex)
            {
                OnUi(() => { ReportTitle = "Export"; Report = $"Export failed: {ex.Message}"; });
            }
        }

        private Task RunNotifyAsync()
        {
            var name = SelectedTemplate?.Name ?? "Workflow";
            if (_results.Count == 0)
            {
                var msg = "No results to notify. Run a file-finding workflow first.";
                AppNotifications.Warning("Nothing to notify", msg);
                OnUi(() =>
                {
                    ReportTitle = "Notify";
                    Report = msg;
                });
                return Task.CompletedTask;
            }

            ulong total = 0;
            string? topName = null;
            ulong topSize = 0;
            foreach (var r in _results)
            {
                total += r.SizeBytes;
                if (r.SizeBytes > topSize) { topSize = r.SizeBytes; topName = r.Name; }
            }
            var sizeText = total > 0 ? ByteFormatter.FormatBytes(total) : "—";
            var topText = topName is not null
                ? $"Largest: {topName} ({ByteFormatter.FormatBytes(topSize)})."
                : string.Empty;
            var summary = $"'{name}' found {_results.Count} result(s) · {sizeText}. {topText}";

            AppNotifications.Success("Workflow results", summary,
                "View results", () => MainWindow.Current?.NavigateToPage("Workflows"));
            OnUi(() =>
            {
                ReportTitle = "Notify";
                Report = $"Notification sent:{Environment.NewLine}{summary}";
            });
            return Task.CompletedTask;
        }

        private async Task RunAiAnalyzeAsync()
        {
            try
            {
                if (_results.Count == 0)
                {
                    OnUi(() => { ReportTitle = "AI Analysis"; Report = "No results to analyze. Run a file-finding workflow first."; });
                    return;
                }
                var url = AppSettings.OllamaUrl;
                if (!AppSettings.OllamaEnabled)
                {
                    OnUi(() => { ReportTitle = "AI Analysis"; Report = "Ollama is disabled in Settings."; });
                    return;
                }
                using var client = new OllamaClient(url);
                if (!await client.IsAvailableAsync(_cts.Token))
                {
                    OnUi(() => { ReportTitle = "AI Analysis"; Report = $"Ollama server at {url} is not reachable. Start Ollama and retry."; });
                    return;
                }
                // Resolve the model: explicit selection if set, otherwise the best
                // available model from the benchmark ranking. If no models are
                // installed at all, say so instead of sending to a missing model.
                var installed = await client.GetInstalledModelsAsync(_cts.Token);
                var recommended = ModelPreferences.PickRecommended(installed);
                if (string.IsNullOrWhiteSpace(AppSettings.OllamaModel) && recommended is null)
                {
                    OnUi(() => { ReportTitle = "AI Analysis"; Report = "No Ollama models are installed. Pull a model (e.g. 'ollama pull qwen3.5:4b') to enable AI analysis."; });
                    return;
                }
                var model = !string.IsNullOrWhiteSpace(AppSettings.OllamaModel)
                    ? AppSettings.OllamaModel
                    : recommended!;
                var prompt = BuildAnalysisPrompt();
                var messages = new List<ChatMessage>
                {
                    new ChatMessage { Role = ChatRole.System, Content = "You are a disk-cleanup analyst. Given a list of files (path, size), suggest concisely what is safe to clean and why. Be specific and terse." },
                    new ChatMessage { Role = ChatRole.User, Content = prompt }
                };
                var response = await client.SendChatMessageAsync(model, messages, ct: _cts.Token);
                var text = response?.Message?.Content ?? "No response from model.";
                OnUi(() =>
                {
                    ReportTitle = "AI Analysis";
                    Report = text;
                });
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                OnUi(() => { ReportTitle = "AI Analysis"; Report = $"AI analysis failed: {ex.Message}"; });
            }
        }

        private string BuildAnalysisPrompt()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"Here are {_results.Count} files from a disk scan:");
            foreach (var r in _results.Take(50))
                sb.AppendLine($"- {r.SizeDisplay}  {r.Path}");
            sb.AppendLine("\nWhich of these are safe to delete or archive to free space?");
            return sb.ToString();
        }

        private void AddHistoryEntry(string workflowName, int resultCount, string status, string actionType = "")
        {
            OnUi(() =>
            {
                History.Insert(0, new WorkflowHistoryEntry
                {
                    WorkflowName = workflowName,
                    ResultCount = resultCount,
                    Status = status,
                    ActionType = actionType,
                    Timestamp = DateTime.Now,
                });
                if (History.Count > 50)
                    History.RemoveAt(History.Count - 1);
                OnPropertyChanged(nameof(HasHistory));
                SaveHistory();
            });
        }

        // ── Persistent execution history (gap 5.5) ──
        // The history used to live only in memory, so it vanished on every app restart. Persist it
        // to a JSON file in the app's LocalFolder so past workflow runs survive across sessions.

        private static string HistoryFilePath =>
            System.IO.Path.Combine(Windows.Storage.ApplicationData.Current.LocalFolder.Path, "workflow-history.json");

}
