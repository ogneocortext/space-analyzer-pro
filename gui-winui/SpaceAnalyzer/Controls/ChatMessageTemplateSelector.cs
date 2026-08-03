// Licensed under the MIT License.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Controls;

/// <summary>
/// Selects the appropriate template for an AIChatMessage:
/// - Tool messages use <see cref="ToolResultTemplate"/> (rendered by <see cref="ToolResultPresenter"/>)
/// - All other messages use <see cref="TextTemplate"/>
/// </summary>
public sealed class ChatMessageTemplateSelector : DataTemplateSelector
{
    public DataTemplate? TextTemplate { get; set; }
    public DataTemplate? ToolResultTemplate { get; set; }

    protected override DataTemplate SelectTemplateCore(object item, DependencyObject container)
    {
        if (item is AIChatMessage msg && msg.Role == Services.ChatRole.Tool)
            return ToolResultTemplate ?? TextTemplate ?? base.SelectTemplateCore(item, container);

        return TextTemplate ?? base.SelectTemplateCore(item, container);
    }
}
