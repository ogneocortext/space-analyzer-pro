using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using System.Drawing;

namespace QuickFileBrowser
{
    public partial class MainForm : Form
    {
        private TextBox pathTextBox;
        private Button browseButton;
        private Button analyzeButton;
        private TreeView fileTreeView;
        private ListView detailsListView;
        private SplitContainer splitContainer;
        private Label statusLabel;
        private ProgressBar progressBar;
        private ContextMenuStrip contextMenu;
        
        private Dictionary<string, FileAnalysis> fileAnalysisCache;
        private string currentPath;
        
        public MainForm()
        {
            fileAnalysisCache = new Dictionary<string, FileAnalysis>();
            InitializeComponent();
            SetupUI();
            LoadInitialPath();
        }
        
        private void InitializeComponent()
        {
            this.Text = "Quick File Browser - System Analysis Tool";
            this.Size = new Size(1200, 800);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Icon = SystemIcons.Application;
        }
        
        private void SetupUI()
        {
            // Top panel
            Panel topPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 60,
                BackColor = Color.FromArgb(45, 45, 48)
            };
            
            pathTextBox = new TextBox
            {
                Location = new Point(10, 15),
                Size = new Size(400, 30),
                Font = new Font("Segoe UI", 10),
                BackColor = Color.FromArgb(37, 37, 38),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            
            browseButton = new Button
            {
                Text = "Browse",
                Location = new Point(420, 15),
                Size = new Size(80, 30),
                Font = new Font("Segoe UI", 9),
                BackColor = Color.FromArgb(0, 120, 215),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                UseVisualStyleBackColor = false
            };
            browseButton.FlatAppearance.BorderSize = 0;
            browseButton.Click += BrowseButton_Click;
            
            analyzeButton = new Button
            {
                Text = "Analyze Origin",
                Location = new Point(510, 15),
                Size = new Size(100, 30),
                Font = new Font("Segoe UI", 9),
                BackColor = Color.FromArgb(16, 124, 16),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                UseVisualStyleBackColor = false
            };
            analyzeButton.FlatAppearance.BorderSize = 0;
            analyzeButton.Click += AnalyzeButton_Click;
            
            topPanel.Controls.AddRange(new Control[] { pathTextBox, browseButton, analyzeButton });
            
            // Status bar
            Panel statusPanel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 30,
                BackColor = Color.FromArgb(45, 45, 48)
            };
            
            statusLabel = new Label
            {
                Text = "Ready",
                Location = new Point(10, 5),
                Size = new Size(300, 20),
                Font = new Font("Segoe UI", 9),
                ForeColor = Color.LightGray
            };
            
            progressBar = new ProgressBar
            {
                Location = new Point(320, 8),
                Size = new Size(200, 15),
                Style = ProgressBarStyle.Continuous,
                Visible = false
            };
            
            statusPanel.Controls.AddRange(new Control[] { statusLabel, progressBar });
            
            // Main content
            splitContainer = new SplitContainer
            {
                Dock = DockStyle.Fill,
                SplitterDistance = 400,
                BackColor = Color.FromArgb(37, 37, 38)
            };
            
            // Tree view for folders
            fileTreeView = new TreeView
            {
                Dock = DockStyle.Fill,
                Font = new Font("Segoe UI", 9),
                BackColor = Color.FromArgb(37, 37, 38),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.None,
                ShowPlusMinus = true,
                ShowLines = false,
                ShowRootLines = false
            };
            fileTreeView.AfterSelect += FileTreeView_AfterSelect;
            fileTreeView.NodeMouseDoubleClick += FileTreeView_NodeMouseDoubleClick;
            
            // List view for file details
            detailsListView = new ListView
            {
                Dock = DockStyle.Fill,
                View = View.Details,
                Font = new Font("Segoe UI", 9),
                BackColor = Color.FromArgb(37, 37, 38),
                ForeColor = Color.White,
                FullRowSelect = true,
                GridLines = true,
                BorderStyle = BorderStyle.None
            };
            
            detailsListView.Columns.Add("Name", 200);
            detailsListView.Columns.Add("Size", 100);
            detailsListView.Columns.Add("Modified", 150);
            detailsListView.Columns.Add("Origin", 150);
            detailsListView.Columns.Add("Risk Level", 100);
            detailsListView.Columns.Add("Confidence", 100);
            
            // Context menu
            contextMenu = new ContextMenuStrip();
            contextMenu.Items.Add("Open File Location", null, (s, e) => OpenFileLocation());
            contextMenu.Items.Add("File Properties", null, (s, e) => ShowFileProperties());
            contextMenu.Items.Add("-");
            contextMenu.Items.Add("Analyze Origin", null, (s, e) => AnalyzeSelectedFile());
            detailsListView.ContextMenuStrip = contextMenu;
            
            splitContainer.Panel1.Controls.Add(fileTreeView);
            splitContainer.Panel2.Controls.Add(detailsListView);
            
            // Add controls to form
            this.Controls.AddRange(new Control[] { topPanel, splitContainer, statusPanel });
        }
        
        private void LoadInitialPath()
        {
            // Load default user directory
            string defaultPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            pathTextBox.Text = defaultPath;
            currentPath = defaultPath;
            LoadDirectory(defaultPath);
        }
        
        private void BrowseButton_Click(object sender, EventArgs e)
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Select folder to analyze";
                dialog.SelectedPath = currentPath;
                
                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    pathTextBox.Text = dialog.SelectedPath;
                    currentPath = dialog.SelectedPath;
                    LoadDirectory(dialog.SelectedPath);
                }
            }
        }
        
        private void AnalyzeButton_Click(object sender, EventArgs e)
        {
            if (Directory.Exists(currentPath))
            {
                AnalyzeDirectory(currentPath);
            }
        }
        
        private void LoadDirectory(string path)
        {
            try
            {
                statusLabel.Text = $"Loading: {path}";
                Application.DoEvents();
                
                fileTreeView.Nodes.Clear();
                
                var rootNode = new TreeNode(Path.GetFileName(path))
                {
                    Tag = path,
                    ImageIndex = 0,
                    SelectedImageIndex = 0
                };
                
                fileTreeView.Nodes.Add(rootNode);
                LoadSubDirectories(rootNode, path);
                rootNode.Expand();
                
                LoadFiles(path);
                statusLabel.Text = $"Ready - {GetFileCount(path)} files";
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error loading directory: {ex.Message}", "Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                statusLabel.Text = "Error loading directory";
            }
        }
        
        private void LoadSubDirectories(TreeNode parentNode, string path)
        {
            try
            {
                var subdirs = Directory.GetDirectories(path)
                    .OrderBy(d => Path.GetFileName(d))
                    .ToArray();
                
                foreach (var subdir in subdirs)
                {
                    try
                    {
                        var node = new TreeNode(Path.GetFileName(subdir))
                        {
                            Tag = subdir
                        };
                        
                        // Add dummy node to show expandable
                        node.Nodes.Add("");
                        parentNode.Nodes.Add(node);
                    }
                    catch
                    {
                        // Skip directories we can't access
                    }
                }
            }
            catch
            {
                // Skip if we can't enumerate subdirectories
            }
        }
        
        private void LoadFiles(string path)
        {
            try
            {
                detailsListView.Items.Clear();
                
                var files = Directory.GetFiles(path)
                    .OrderBy(f => Path.GetFileName(f))
                    .ToArray();
                
                foreach (var file in files)
                {
                    try
                    {
                        var fileInfo = new FileInfo(file);
                        var item = new ListViewItem(Path.GetFileName(file))
                        {
                            Tag = file
                        };
                        
                        item.SubItems.Add(FormatFileSize(fileInfo.Length));
                        item.SubItems.Add(fileInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm"));
                        
                        // Get cached analysis or create placeholder
                        if (fileAnalysisCache.ContainsKey(file))
                        {
                            var analysis = fileAnalysisCache[file];
                            item.SubItems.Add(analysis.Origin);
                            item.SubItems.Add(analysis.RiskLevel);
                            item.SubItems.Add(analysis.Confidence);
                            
                            // Color code by risk level
                            switch (analysis.RiskLevel)
                            {
                                case "High":
                                    item.ForeColor = Color.Red;
                                    break;
                                case "Medium":
                                    item.ForeColor = Color.Orange;
                                    break;
                                case "Low":
                                    item.ForeColor = Color.LightGreen;
                                    break;
                            }
                        }
                        else
                        {
                            item.SubItems.Add("Unknown");
                            item.SubItems.Add("Unknown");
                            item.SubItems.Add("Unknown");
                        }
                        
                        detailsListView.Items.Add(item);
                    }
                    catch
                    {
                        // Skip files we can't access
                    }
                }
            }
            catch
            {
                // Skip if we can't enumerate files
            }
        }
        
        private void FileTreeView_AfterSelect(object sender, TreeViewEventArgs e)
        {
            if (e.Node.Tag is string path)
            {
                currentPath = path;
                pathTextBox.Text = path;
                
                // Clear dummy node and load actual subdirectories
                if (e.Node.Nodes.Count == 1 && e.Node.Nodes[0].Text == "")
                {
                    e.Node.Nodes.Clear();
                    LoadSubDirectories(e.Node, path);
                }
                
                LoadFiles(path);
                statusLabel.Text = $"Ready - {GetFileCount(path)} files";
            }
        }
        
        private void FileTreeView_NodeMouseDoubleClick(object sender, TreeNodeMouseClickEventArgs e)
        {
            if (e.Node.Tag is string path && Directory.Exists(path))
            {
                LoadDirectory(path);
            }
        }
        
        private void AnalyzeDirectory(string path)
        {
            statusLabel.Text = "Analyzing file origins...";
            progressBar.Visible = true;
            progressBar.Value = 0;
            Application.DoEvents();
            
            try
            {
                var files = Directory.GetFiles(path, "*.*", SearchOption.AllDirectories);
                progressBar.Maximum = files.Length;
                
                int analyzed = 0;
                foreach (var file in files)
                {
                    try
                    {
                        var analysis = AnalyzeFile(file);
                        fileAnalysisCache[file] = analysis;
                        
                        analyzed++;
                        if (analyzed % 10 == 0)
                        {
                            progressBar.Value = analyzed;
                            statusLabel.Text = $"Analyzed {analyzed}/{files.Length} files...";
                            Application.DoEvents();
                        }
                    }
                    catch
                    {
                        // Skip files that can't be analyzed
                    }
                }
                
                LoadFiles(path); // Refresh the list view
                statusLabel.Text = $"Analysis complete - {analyzed} files analyzed";
                progressBar.Visible = false;
                
                MessageBox.Show($"Analysis complete!\n\nAnalyzed {analyzed} files.\n" +
                    $"Safe to delete: {fileAnalysisCache.Values.Count(a => a.RiskLevel == "Low")}\n" +
                    $"High risk: {fileAnalysisCache.Values.Count(a => a.RiskLevel == "High")}", 
                    "Analysis Results", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error during analysis: {ex.Message}", "Analysis Error", 
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                statusLabel.Text = "Analysis failed";
                progressBar.Visible = false;
            }
        }
        
        private FileAnalysis AnalyzeFile(string filePath)
        {
            var analysis = new FileAnalysis
            {
                Path = filePath,
                Origin = "Unknown",
                RiskLevel = "Unknown",
                Confidence = "Low"
            };
            
            try
            {
                var fileInfo = new FileInfo(filePath);
                
                // Check system locations
                var systemPaths = new[] { 
                    Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)
                };
                
                foreach (var sysPath in systemPaths)
                {
                    if (filePath.StartsWith(sysPath, StringComparison.OrdinalIgnoreCase))
                    {
                        analysis.Origin = "Windows System";
                        analysis.RiskLevel = "High";
                        analysis.Confidence = "High";
                        return analysis;
                    }
                }
                
                // Check file extensions
                var extension = Path.GetExtension(filePath).ToLower();
                var riskMap = new Dictionary<string, string>
                {
                    { ".exe", "Medium" },
                    { ".dll", "Medium" },
                    { ".sys", "High" },
                    { ".msi", "Low" },
                    { ".log", "Low" },
                    { ".tmp", "Low" },
                    { ".bak", "Low" },
                    { ".old", "Low" }
                };
                
                if (riskMap.ContainsKey(extension))
                {
                    analysis.RiskLevel = riskMap[extension];
                    analysis.Origin = GetOriginFromExtension(extension);
                    analysis.Confidence = "Medium";
                }
                
                // Check file age
                var daysOld = (DateTime.Now - fileInfo.LastWriteTime).Days;
                if (daysOld > 365 && analysis.RiskLevel == "Unknown")
                {
                    analysis.Origin = "Old File";
                    analysis.RiskLevel = "Low";
                    analysis.Confidence = "Medium";
                }
                
                // Check for temp/cache patterns
                var fileName = Path.GetFileName(filePath).ToLower();
                if (fileName.Contains("temp") || fileName.Contains("cache") || 
                    fileName.Contains("tmp") || extension == ".tmp")
                {
                    analysis.Origin = "Temporary/Cache";
                    analysis.RiskLevel = "Low";
                    analysis.Confidence = "High";
                }
            }
            catch
            {
                // Keep default values if analysis fails
            }
            
            return analysis;
        }
        
        private string GetOriginFromExtension(string extension)
        {
            var originMap = new Dictionary<string, string>
            {
                { ".exe", "Executable" },
                { ".dll", "Library" },
                { ".sys", "System Driver" },
                { ".msi", "Installer" },
                { ".log", "Log File" },
                { ".tmp", "Temporary" },
                { ".bak", "Backup" },
                { ".old", "Old File" }
            };
            
            return originMap.ContainsKey(extension) ? originMap[extension] : "Unknown";
        }
        
        private int GetFileCount(string path)
        {
            try
            {
                return Directory.GetFiles(path).Length;
            }
            catch
            {
                return 0;
            }
        }
        
        private string FormatFileSize(long bytes)
        {
            string[] sizes = { "B", "KB", "MB", "GB" };
            double len = bytes;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len = len / 1024;
            }
            return $"{len:0.##} {sizes[order]}";
        }
        
        private void OpenFileLocation()
        {
            if (detailsListView.SelectedItems.Count > 0)
            {
                string filePath = detailsListView.SelectedItems[0].Tag as string;
                if (!string.IsNullOrEmpty(filePath))
                {
                    System.Diagnostics.Process.Start("explorer.exe", $"/select,\"{filePath}\"");
                }
            }
        }
        
        private void ShowFileProperties()
        {
            if (detailsListView.SelectedItems.Count > 0)
            {
                string filePath = detailsListView.SelectedItems[0].Tag as string;
                if (!string.IsNullOrEmpty(filePath))
                {
                    var fileInfo = new FileInfo(filePath);
                    string properties = $"File: {fileInfo.Name}\n" +
                        $"Path: {fileInfo.DirectoryName}\n" +
                        $"Size: {FormatFileSize(fileInfo.Length)}\n" +
                        $"Created: {fileInfo.CreationTime}\n" +
                        $"Modified: {fileInfo.LastWriteTime}\n" +
                        $"Accessed: {fileInfo.LastAccessTime}";
                    
                    MessageBox.Show(properties, "File Properties", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
        }
        
        private void AnalyzeSelectedFile()
        {
            if (detailsListView.SelectedItems.Count > 0)
            {
                string filePath = detailsListView.SelectedItems[0].Tag as string;
                if (!string.IsNullOrEmpty(filePath))
                {
                    var analysis = AnalyzeFile(filePath);
                    fileAnalysisCache[filePath] = analysis;
                    LoadFiles(currentPath); // Refresh to show updated analysis
                    
                    MessageBox.Show($"File: {Path.GetFileName(filePath)}\n" +
                        $"Origin: {analysis.Origin}\n" +
                        $"Risk Level: {analysis.RiskLevel}\n" +
                        $"Confidence: {analysis.Confidence}", 
                        "File Analysis", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
        }
    }
    
    public class FileAnalysis
    {
        public string Path { get; set; }
        public string Origin { get; set; }
        public string RiskLevel { get; set; }
        public string Confidence { get; set; }
    }
    
    class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
