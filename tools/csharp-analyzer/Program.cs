using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CSharpAnalyzer;

/// <summary>
/// Roslyn-based semantic C# analyzer.
/// Outputs JSON array of findings to stdout.
/// Usage: CSharpAnalyzer <directory>
/// </summary>
record Finding(string Severity, string Category, string Message, string File, int Line, string Suggestion);

static class AnalyzerHelpers
{
    public static int Line(this SyntaxNode node) =>
        node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;

    public static int Line(this SyntaxToken token) =>
        token.GetLocation().GetLineSpan().StartLinePosition.Line + 1;

    public static MethodDeclarationSyntax? ContainingMethod(this SyntaxNode node) =>
        node.FirstAncestorOrSelf<MethodDeclarationSyntax>();

    public static ClassDeclarationSyntax? ContainingClass(this SyntaxNode node) =>
        node.FirstAncestorOrSelf<ClassDeclarationSyntax>();

    public static bool IsInUsing(this ExpressionSyntax expr)
    {
        // using var x = ...
        if (expr.FirstAncestorOrSelf<LocalDeclarationStatementSyntax>() is { UsingKeyword.RawKind: var usingKind }
            && usingKind != 0)
            return true;

        // using (...) { ... }
        return expr.FirstAncestorOrSelf<UsingStatementSyntax>() != null;
    }

    public static bool IsLocallyAssigned(this FieldDeclarationSyntax field, ClassDeclarationSyntax cls)
    {
        foreach (var ctor in cls.Members.OfType<ConstructorDeclarationSyntax>())
        {
            foreach (var assign in ctor.DescendantNodes().OfType<AssignmentExpressionSyntax>())
            {
                var target = assign.Left.ToString();
                var fieldName = field.Declaration.Variables[0].Identifier.Text;
                if (target == fieldName && assign.Right is ObjectCreationExpressionSyntax)
                    return true;
            }
        }

        var variable = field.Declaration.Variables.FirstOrDefault();
        if (variable != null && variable.Initializer != null && variable.Initializer.Value is ObjectCreationExpressionSyntax)
            return true;

        return false;
    }

    public static bool IsDisposed(this ClassDeclarationSyntax cls, string fieldName)
    {
        var disposeMethod = cls.Members.OfType<MethodDeclarationSyntax>()
            .FirstOrDefault(m => m.Identifier.Text == "Dispose");
        if (disposeMethod == null) return false;

        foreach (var inv in disposeMethod.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            if (inv.Expression is MemberAccessExpressionSyntax ma && ma.Name.Identifier.Text == "Dispose")
            {
                var expr = ma.Expression.ToString();
                if (expr == fieldName || expr == $"{fieldName}?" || expr == $"{fieldName}!")
                    return true;
            }
        }

        // Also check for conditional access: _scanner?.Dispose()
        foreach (var condAccess in disposeMethod.DescendantNodes().OfType<ConditionalAccessExpressionSyntax>())
        {
            if (condAccess.WhenNotNull is InvocationExpressionSyntax { Expression: MemberBindingExpressionSyntax { Name.Identifier.Text: "Dispose" } })
            {
                var expr = condAccess.Expression.ToString();
                if (expr == fieldName)
                    return true;
            }
        }

        // Check for Dispose(bool) pattern
        var disposeBool = cls.Members.OfType<MethodDeclarationSyntax>()
            .FirstOrDefault(m => m.Identifier.Text == "Dispose" && m.ParameterList.Parameters.Count == 1);
        if (disposeBool != null)
        {
            foreach (var inv in disposeBool.DescendantNodes().OfType<InvocationExpressionSyntax>())
            {
                if (inv.Expression is MemberAccessExpressionSyntax ma && ma.Name.Identifier.Text == "Dispose")
                {
                    var expr = ma.Expression.ToString();
                    if (expr == fieldName || expr == $"{fieldName}?" || expr == $"{fieldName}!")
                        return true;
                }
            }

            foreach (var condAccess in disposeBool.DescendantNodes().OfType<ConditionalAccessExpressionSyntax>())
            {
                if (condAccess.WhenNotNull is InvocationExpressionSyntax { Expression: MemberBindingExpressionSyntax { Name.Identifier.Text: "Dispose" } })
                {
                    var expr = condAccess.Expression.ToString();
                    if (expr == fieldName)
                        return true;
                }
            }
        }

        return false;
    }

    public static bool HasStop(this ClassDeclarationSyntax cls)
    {
        return cls.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(inv =>
        {
            if (inv.Expression is MemberAccessExpressionSyntax ma && ma.Name.Identifier.Text == "Stop")
                return true;
            return false;
        });
    }

    public static bool IsHandleReturnType(TypeSyntax returnType)
    {
        var text = returnType.ToString();
        return text == "IntPtr" || text == "UIntPtr" || text == "IntPtr?" || text == "UIntPtr?"
            || text.Contains("HANDLE") || text.Contains("HWND") || text.Contains("HMODULE")
            || text.Contains("HINSTANCE") || text.Contains("HKEY") || text.Contains("HLOCAL")
            || text == "void*" || text.Contains("Handle");
    }

    public static bool HasRefStructParam(MethodDeclarationSyntax method)
    {
        return method.ParameterList.Parameters.Any(p =>
        {
            var mods = p.Modifiers.ToString();
            var type = p.Type?.ToString() ?? "";
            return (mods.Contains("ref") || mods.Contains("out")) && !type.StartsWith("class")
                && type != "string" && type != "object";
        });
    }

    /// <summary>Returns the rightmost identifier of a type or name, ignoring namespace qualification
    /// (e.g. <c>System.Windows.Media.SolidColorBrush</c> and <c>SolidColorBrush</c> both yield "SolidColorBrush").</summary>
    public static string SimpleName(this TypeSyntax type) => type switch
    {
        IdentifierNameSyntax id => id.Identifier.Text,
        GenericNameSyntax g => g.Identifier.Text,
        QualifiedNameSyntax q => SimpleName(q.Right),
        AliasQualifiedNameSyntax a => SimpleName(a.Name),
        _ => type.ToString()
    };

    public static string SimpleName(this NameSyntax name) => name switch
    {
        IdentifierNameSyntax id => id.Identifier.Text,
        GenericNameSyntax g => g.Identifier.Text,
        QualifiedNameSyntax q => SimpleName(q.Right),
        AliasQualifiedNameSyntax a => SimpleName(a.Name),
        _ => name.ToString()
    };

    public static string SimpleName(this ExpressionSyntax expr) => expr switch
    {
        NameSyntax ns => SimpleName(ns),
        MemberAccessExpressionSyntax ma => SimpleName(ma.Name),
        _ => expr.ToString()
    };

    /// <summary>True if the node is (transitively) the operand of an <c>await</c> expression.</summary>
    public static bool IsAwaited(this SyntaxNode node)
    {
        for (var p = node.Parent; p != null; p = p.Parent)
        {
            if (p is AwaitExpressionSyntax)
                return true;
        }
        return false;
    }
}

class Program
{
    static readonly HashSet<string> SkipDirs = new(StringComparer.OrdinalIgnoreCase)
    {
        "obj", "bin", "packages", ".vs", "node_modules"
    };

    static bool IsInSkipDir(string filePath)
    {
        var segments = filePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return segments.Any(s => SkipDirs.Contains(s, StringComparer.OrdinalIgnoreCase));
    }

    static readonly string[] DisposableTypeKeywords =
    {
        "PerformanceCounter", "Process", "FileStream", "StreamReader",
        "StreamWriter", "DbContext", "CancellationTokenSource", "HttpClient",
        "SqlConnection", "DbConnection", "MemoryStream", "BinaryReader", "BinaryWriter",
        "IDisposable"
    };

    static readonly HashSet<string> CollectionTypePrefixes = new(StringComparer.Ordinal)
    {
        "List<", "Dictionary<", "ConcurrentBag<", "ConcurrentQueue<", "ConcurrentStack<",
        "BlockingCollection<", "ObservableCollection<", "HashSet<", "SortedSet<", "Queue<", "Stack<",
        "IEnumerable<", "IReadOnlyList<", "IReadOnlyDictionary<", "ICollection<", "IList<", "IDictionary<"
    };

    static bool IsCollectionType(string typeText)
    {
        return CollectionTypePrefixes.Any(p => typeText.StartsWith(p, StringComparison.Ordinal));
    }

    static HashSet<string> CollectPathVariables(SyntaxNode root)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);

        foreach (var assign in root.DescendantNodes().OfType<AssignmentExpressionSyntax>())
        {
            var right = assign.Right.ToString();
            if (right.Contains("Path.Combine") || right.Contains("AppContext.BaseDirectory") || right.Contains("Path.GetTempPath"))
            {
                var left = assign.Left.ToString();
                if (!string.IsNullOrWhiteSpace(left))
                    result.Add(left);
            }
        }

        foreach (var localDecl in root.DescendantNodes().OfType<LocalDeclarationStatementSyntax>())
        {
            foreach (var variable in localDecl.Declaration.Variables)
            {
                if (variable.Initializer == null)
                    continue;

                var right = variable.Initializer.Value.ToString();
                if (right.Contains("Path.Combine") || right.Contains("AppContext.BaseDirectory") || right.Contains("Path.GetTempPath"))
                {
                    result.Add(variable.Identifier.Text);
                }
            }
        }

        return result;
    }

    static bool MethodHasCancellationTokenParameter(MethodDeclarationSyntax method)
    {
        return method.ParameterList.Parameters.Any(p =>
            p.Type?.ToString() == "CancellationToken" ||
            p.Type?.ToString() == "CancellationToken?");
    }

    static async Task Main(string[] args)
    {
        var rootDir = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
        var findings = new List<Finding>();

        foreach (var csFile in Directory.EnumerateFiles(rootDir, "*.cs", SearchOption.AllDirectories))
        {
            if (IsInSkipDir(csFile))
                continue;

            try
            {
                var source = await File.ReadAllTextAsync(csFile);
                // Parse with the latest language version so the analyzer understands modern
                // C# (collection expressions, primary constructors, params collections, ref
                // fields, etc.) enabled by the Roslyn 5.9.0 compiler bump.
                var tree = CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.Latest), csFile);
                var root = await tree.GetRootAsync();
                var relPath = Path.GetRelativePath(rootDir, csFile).Replace('\\', '/');

                AnalyzeFile(root, relPath, findings);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Warning: skipped {csFile}: {ex.Message}");
            }
        }

        var json = JsonSerializer.Serialize(findings, new JsonSerializerOptions { WriteIndented = true });
        Console.WriteLine(json);
    }

    static void AnalyzeFile(SyntaxNode root, string filePath, List<Finding> findings)
    {
        var methods = root.DescendantNodes().OfType<MethodDeclarationSyntax>().ToList();
        var classes = root.DescendantNodes().OfType<ClassDeclarationSyntax>().ToList();
        var safePathVariables = CollectPathVariables(root);

        // 1. async void non-event-handler
        foreach (var method in methods)
        {
            var isAsync = method.Modifiers.Any(m => m.Text == "async");
            var returnType = method.ReturnType.ToString();

            if (!isAsync || returnType != "void")
                continue;

            var paramList = method.ParameterList.Parameters;
            if (paramList.Count == 2)
            {
                var p0 = paramList[0].Type?.ToString() ?? "";
                var p1 = paramList[1].Type?.ToString() ?? "";
                if (p0 == "object" && p1 == "RoutedEventArgs")
                    continue;
            }

            var body = method.Body;
            if (body != null && body.Statements.Count == 1)
            {
                if (body.Statements[0] is ExpressionStatementSyntax { Expression: InvocationExpressionSyntax })
                    continue;
            }

            findings.Add(new("medium", "async",
                "async void method can swallow exceptions and crash the process.",
                filePath, method.Identifier.Line(),
                "Use async Task unless this is an event handler; if event handler, wrap body in try/catch."));
        }

        // 2. GetAwaiter().GetResult() in non-async method
        foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            if (invocation.Expression is not MemberAccessExpressionSyntax getResult ||
                getResult.Name.Identifier.Text != "GetResult")
                continue;

            if (getResult.Expression is not MemberAccessExpressionSyntax getAwaiter ||
                getAwaiter.Name.Identifier.Text != "GetAwaiter")
                continue;

            var containingMethod = invocation.ContainingMethod();
            if (containingMethod != null && !containingMethod.Modifiers.Any(m => m.Text == "async"))
            {
                findings.Add(new("high", "async",
                    "Blocking on async code with .GetAwaiter().GetResult() can deadlock the UI thread.",
                    filePath, invocation.Line(),
                    "Use await all the way up the call chain and make the caller async."));
            }
        }

        // 3. Empty catch block
        foreach (var catchClause in root.DescendantNodes().OfType<CatchClauseSyntax>())
        {
            var block = catchClause.Block;
            if (block != null && !block.Statements.Any())
            {
                // An empty catch paired with a finally that performs cleanup is a tolerable pattern.
                var tryStmt = catchClause.FirstAncestorOrSelf<TryStatementSyntax>();
                if (tryStmt?.Finally != null)
                    continue;

                findings.Add(new("medium", "error-handling",
                    "Empty catch block will silently swallow exceptions.",
                    filePath, catchClause.Line(),
                    "Log the exception or handle it explicitly."));
            }
        }

        // 4. ConfigureAwait(false) not part of await
        foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
                if (invocation.Expression is MemberAccessExpressionSyntax { Name.Identifier.Text: "ConfigureAwait" })
                {
                    if (!AnalyzerHelpers.IsAwaited(invocation))
                    {
                        findings.Add(new("low", "async",
                            "ConfigureAwait(false) on a non-awaited call has no effect.",
                            filePath, invocation.Line(),
                            "Remove if not paired with await."));
                    }
                }
        }

        // 5. Await subprocess without ConfigureAwait(false)
        foreach (var awaitExpr in root.DescendantNodes().OfType<AwaitExpressionSyntax>())
        {
            if (awaitExpr.Expression is InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax ma }
                && ma.Expression.SimpleName() is var recvName
                && (recvName is "Scanner" or "Process" or "_scanner" || recvName.EndsWith("Scanner", StringComparison.Ordinal)))
            {
                var hasConfigureAwait = awaitExpr.DescendantNodes().OfType<InvocationExpressionSyntax>()
                    .Any(i => i.Expression is MemberAccessExpressionSyntax { Name.Identifier.Text: "ConfigureAwait" });
                if (!hasConfigureAwait)
                {
                    findings.Add(new("low", "async",
                        "Awaited Rust subprocess call in ViewModel/service without ConfigureAwait(false) can capture UI context unnecessarily.",
                        filePath, awaitExpr.Line(),
                        "Add .ConfigureAwait(false) to scanner await calls in ViewModels/services."));
                }
            }
        }

        // 6. P/Invoke SafeHandle analysis
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            var hasDllImport = method.AttributeLists
                .SelectMany(a => a.Attributes)
                .Any(a => a.Name.ToString().Contains("DllImport"));

            if (!hasDllImport)
                continue;

            // If method has ref/out struct params (like MEMORYSTATUSEX), it's filling in data, not returning a handle
            if (AnalyzerHelpers.HasRefStructParam(method))
                continue;

            if (AnalyzerHelpers.IsHandleReturnType(method.ReturnType))
            {
                findings.Add(new("high", "interop",
                    "P/Invoke returns an owned native handle without SafeHandle; leaks on exceptions.",
                    filePath, method.ReturnType.Line(),
                    "Wrap the native handle in a SafeHandle-derived class."));
            }
        }

        // 7. Task.Run without await
        foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            if (invocation.Expression is MemberAccessExpressionSyntax { Name.Identifier.Text: "Run" } ma
                && ma.Expression.SimpleName() == "Task")
            {
                if (!AnalyzerHelpers.IsAwaited(invocation) && !AnalyzerHelpers.IsInUsing(invocation))
                {
                    findings.Add(new("medium", "async",
                        "Task.Run started without await; exceptions become unobserved.",
                        filePath, invocation.Line(),
                        "await the Task or attach a ContinueWith / Try/Catch."));
                }
            }
        }

        // 8. Raw Thread
        foreach (var creation in root.DescendantNodes().OfType<ObjectCreationExpressionSyntax>())
        {
            if (creation.Type.SimpleName() == "Thread")
            {
                findings.Add(new("high", "threading",
                    "Raw Thread creation bypasses the WinUI 3 dispatcher and can crash UI access.",
                    filePath, creation.Line(),
                    "Use Task.Run or DispatcherQueue to keep work on the right thread."));
            }
        }

        // 9. CancellationToken.None in async method
        foreach (var memberAccess in root.DescendantNodes().OfType<MemberAccessExpressionSyntax>())
        {
            if (memberAccess.Name.Identifier.Text == "None"
                && memberAccess.Expression.SimpleName() == "CancellationToken")
            {
                var containingMethod = memberAccess.ContainingMethod();
                if (containingMethod != null
                    && containingMethod.Modifiers.Any(m => m.Text == "async")
                    && !MethodHasCancellationTokenParameter(containingMethod))
                {
                    findings.Add(new("low", "async",
                        "Explicit CancellationToken.None makes cancellation impossible.",
                        filePath, memberAccess.Line(),
                        "Accept a CancellationToken parameter and pass it through."));
                }
            }
        }

        // 10. Process without dispose
        foreach (var creation in root.DescendantNodes().OfType<ObjectCreationExpressionSyntax>())
        {
            if (creation.Type.SimpleName() == "Process" && !AnalyzerHelpers.IsInUsing(creation))
            {
                findings.Add(new("medium", "interop",
                    "Process created without using/Dispose; OS handle may leak on repeated calls.",
                    filePath, creation.Line(),
                    "Wrap Process in a using statement or call Dispose()."));
            }
        }

        // 11. DispatcherTimer without Stop
        foreach (var creation in root.DescendantNodes().OfType<ObjectCreationExpressionSyntax>())
        {
            if (creation.Type.SimpleName() == "DispatcherTimer")
            {
                var cls = creation.ContainingClass();
                if (cls != null && !AnalyzerHelpers.HasStop(cls))
                {
                    findings.Add(new("medium", "memory",
                        "DispatcherTimer started but never stopped; can keep the page alive after navigation.",
                        filePath, creation.Line(),
                        "Stop the timer in OnNavigatedFrom or Dispose()."));
                }
            }
        }

        // 12. ReadToEndAsync without WaitForExitAsync
        foreach (var method in methods)
        {
            var hasReadToEnd = method.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(inv =>
            {
                if (inv.Expression is MemberAccessExpressionSyntax ma)
                {
                    var name = ma.Name.Identifier.Text;
                    return name == "ReadToEndAsync" || name == "ReadToEnd";
                }
                return false;
            });

            var hasWaitForExit = method.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(inv =>
            {
                if (inv.Expression is MemberAccessExpressionSyntax ma)
                {
                    var name = ma.Name.Identifier.Text;
                    return name == "WaitForExitAsync" || name == "WaitForExit";
                }
                return false;
            });

            if (hasReadToEnd && !hasWaitForExit)
            {
                var readLine = method.DescendantNodes().OfType<InvocationExpressionSyntax>()
                    .FirstOrDefault(inv =>
                    {
                        if (inv.Expression is MemberAccessExpressionSyntax ma)
                        {
                            var name = ma.Name.Identifier.Text;
                            return name == "ReadToEndAsync" || name == "ReadToEnd";
                        }
                        return false;
                    });
                if (readLine != null)
                {
                    findings.Add(new("medium", "interop",
                        "Reading process output without waiting for exit can deadlock if the buffer fills.",
                        filePath, readLine.Line(),
                        "Use process.WaitForExitAsync() after reading streams, or use BeginOutputReadLine."));
                }
            }
        }

        // 13. JsonSerializer.Deserialize without options
        foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            if (invocation.Expression is MemberAccessExpressionSyntax { Name.Identifier.Text: "Deserialize" } ma
                && ma.Expression.SimpleName() == "JsonSerializer")
            {
                var method = invocation.ContainingMethod();
                if (method != null && !method.DescendantNodes().OfType<ObjectCreationExpressionSyntax>().Any(
                        o => o.Type.SimpleName() == "JsonSerializerOptions"))
                {
                    findings.Add(new("medium", "data",
                        "JSON deserialization without explicit options may fail on case or missing members.",
                        filePath, invocation.Line(),
                        "Pass JsonSerializerOptions with PropertyNameCaseInsensitive = true."));
                }
            }
        }

        // 14. Missing RedirectStandardError
        foreach (var assign in root.DescendantNodes().OfType<AssignmentExpressionSyntax>())
        {
            if (assign.Left.ToString().Contains("RedirectStandardOutput") &&
                assign.Right.ToString().Contains("true"))
            {
                var method = assign.ContainingMethod();
                if (method != null && !method.DescendantNodes().OfType<AssignmentExpressionSyntax>().Any(
                        a => a.Left.ToString().Contains("RedirectStandardError")))
                {
                    findings.Add(new("medium", "interop",
                        "RedirectStandardOutput is set but RedirectStandardError is missing; stderr may interleave or crash.",
                        filePath, assign.Line(),
                        "Also set RedirectStandardError = true and read both streams."));
                }
            }
        }

        // 15. File.Exists without Path.Combine
        foreach (var invocation in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            if (invocation.Expression is MemberAccessExpressionSyntax { Name.Identifier.Text: "Exists" } ma
                && ma.Expression.SimpleName() == "File")
            {
                var arg = invocation.ArgumentList.Arguments.FirstOrDefault();
                if (arg == null)
                    continue;

                var argText = arg.Expression.ToString();
                if (argText.Contains("Path.Combine") || argText.Contains("AppContext.BaseDirectory"))
                    continue;

                if (safePathVariables.Contains(argText))
                    continue;

                findings.Add(new("low", "paths",
                    "File path may not be combined safely; check for path traversal or missing separator.",
                    filePath, invocation.Line(),
                    "Use Path.Combine for cross-platform path construction."));
            }
        }

        // 16. SolidColorBrush inline
        foreach (var creation in root.DescendantNodes().OfType<ObjectCreationExpressionSyntax>())
        {
            if (creation.Type.SimpleName() == "SolidColorBrush")
            {
                findings.Add(new("low", "memory",
                    "SolidColorBrush created inline is not cached; repeated property access allocates new brushes.",
                    filePath, creation.Line(),
                    "Cache brushes as readonly fields or use theme resources."));
            }
        }

        // 17. null assignment without nullable annotation
        foreach (var field in root.DescendantNodes().OfType<FieldDeclarationSyntax>())
        {
            foreach (var variable in field.Declaration.Variables)
            {
                if (variable.Initializer != null && variable.Initializer.Value.IsKind(SyntaxKind.NullLiteralExpression))
                {
                    var typeText = field.Declaration.Type.ToString();
                    if (!typeText.EndsWith("?") && !typeText.Contains("?"))
                    {
                        findings.Add(new("low", "null-safety",
                            "Assignment of null without null-forgiving or null-coalescing; potential NRE downstream.",
                            filePath, variable.Initializer.Line(),
                            "Use string? or ?? string.Empty, or guard with null checks."));
                    }
                }
            }
        }

        // 18. ViewModel not disposing disposable fields
        foreach (var cls in classes)
        {
            if (!cls.Modifiers.Any(m => m.Text == "public") && !cls.Modifiers.Any(m => m.Text == "internal"))
                continue;

            var hasIDisposable = cls.BaseList?.Types.Any(t => t.Type.ToString() == "IDisposable") == true
                || cls.Members.OfType<MethodDeclarationSyntax>().Any(m => m.Identifier.Text == "Dispose");

            if (!hasIDisposable)
                continue;

            foreach (var field in cls.Members.OfType<FieldDeclarationSyntax>())
            {
                var fieldType = field.Declaration.Type.ToString();
                if (IsCollectionType(fieldType))
                    continue;

                var isDisposableType = DisposableTypeKeywords.Any(kw => fieldType.Contains(kw));
                if (!isDisposableType)
                    continue;

                foreach (var variable in field.Declaration.Variables)
                {
                    if (!AnalyzerHelpers.IsDisposed(cls, variable.Identifier.Text))
                    {
                        findings.Add(new("medium", "memory",
                            $"Class holds {fieldType} but does not dispose it in Dispose().",
                            filePath, cls.OpenBraceToken.Line(),
                            $"Call {variable.Identifier.Text}?.Dispose() in Dispose() if {fieldType} implements IDisposable."));
                    }
                }
            }
        }

        // 19. ViewModel missing IDisposable with PerformanceCounter
        foreach (var cls in classes)
        {
            if (cls.Modifiers.Any(m => m.Text == "static"))
                continue;

            var hasPerfCounter = cls.Members.OfType<FieldDeclarationSyntax>().Any(f =>
                f.Declaration.Type.ToString().Contains("PerformanceCounter"));

            if (!hasPerfCounter)
                continue;

            var hasIDisposable = cls.BaseList?.Types.Any(t => t.Type.ToString() == "IDisposable") == true
                || cls.Members.OfType<MethodDeclarationSyntax>().Any(m => m.Identifier.Text == "Dispose");

            if (!hasIDisposable)
            {
                findings.Add(new("medium", "memory",
                    "Class holds PerformanceCounter but does not implement IDisposable.",
                    filePath, cls.OpenBraceToken.Line(),
                    "Implement IDisposable and dispose _cpuCounter."));
            }
        }

        // 20. UI property mutation after Task.Run await (simplified)
        foreach (var method in methods)
        {
            var hasTaskRun = method.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(inv =>
            {
                if (inv.Expression is MemberAccessExpressionSyntax ma && ma.Name.Identifier.Text == "Run")
                {
                    return ma.Expression is IdentifierNameSyntax { Identifier.Text: "Task" };
                }
                return false;
            });

            if (!hasTaskRun)
                continue;

            var hasDispatcher = method.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(inv =>
            {
                if (inv.Expression is MemberAccessExpressionSyntax ma)
                {
                    var name = ma.Name.Identifier.Text;
                    return name == "TryEnqueue" || name == "RunAsync";
                }
                return false;
            });

            // Look for UI property assignments after Task.Run without DispatcherQueue
            var taskRunLine = method.DescendantNodes().OfType<InvocationExpressionSyntax>()
                .FirstOrDefault(inv =>
                {
                    if (inv.Expression is MemberAccessExpressionSyntax ma && ma.Name.Identifier.Text == "Run")
                    {
                        return ma.Expression is IdentifierNameSyntax { Identifier.Text: "Task" };
                    }
                    return false;
                })?.Line() ?? 0;

            foreach (var assign in method.DescendantNodes().OfType<AssignmentExpressionSyntax>())
            {
                if (assign.Line() > taskRunLine && !hasDispatcher)
                {
                    findings.Add(new("medium", "threading",
                        "UI property assignment after await on a background task without DispatcherQueue can crash WinUI 3.",
                        filePath, assign.Line(),
                        "Wrap UI updates in DispatcherQueue.TryEnqueue(() => ...) when continuing from a background task."));
                    break;
                }
            }
        }

        // 21. Synchronous blocking on tasks (.Result / .Wait())
        foreach (var memberAccess in root.DescendantNodes().OfType<MemberAccessExpressionSyntax>())
        {
            var name = memberAccess.Name.Identifier.Text;
            if (name is not ("Result" or "Wait"))
                continue;

            var recvName = memberAccess.Expression.SimpleName();
            if (!recvName.Contains("Task"))
                continue;

            var containingMethod = memberAccess.ContainingMethod();
            if (containingMethod != null && containingMethod.Modifiers.Any(m => m.Text == "async"))
                continue;

            findings.Add(new("high", "async",
                $"Blocking on a task with .{name} on the UI thread can deadlock and freeze the app.",
                filePath, memberAccess.Line(),
                "Use await instead of .Result/.Wait() and make the caller async."));
        }
    }

}
