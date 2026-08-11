// Licensed under the MIT License.

using System.ComponentModel;
using SpaceAnalyzer.ViewModels;

namespace SpaceAnalyzer.Tests;

/// <summary>
/// Tests for <see cref="ViewModelBase"/> — the shared base class for all WinUI 3 ViewModels.
/// Verifies property change notification and SetField equality short-circuit.
/// </summary>
public class ViewModelBaseTests
{
    private sealed class TestViewModel : ViewModelBase
    {
        private string _name = string.Empty;
        public string Name
        {
            get => _name;
            set => SetField(ref _name, value);
        }

        private int _count;
        public int Count
        {
            get => _count;
            set => SetField(ref _count, value);
        }
    }

    [Fact]
    public void PropertyChanged_Fires_WhenPropertyValueChanges()
    {
        var vm = new TestViewModel();
        var firedEvents = new List<string>();

        vm.PropertyChanged += (_, args) => firedEvents.Add(args.PropertyName!);

        vm.Name = "test";
        vm.Count = 42;

        Assert.Contains(nameof(TestViewModel.Name), firedEvents);
        Assert.Contains(nameof(TestViewModel.Count), firedEvents);
    }

    [Fact]
    public void PropertyChanged_DoesNotFire_WhenPropertyValueUnchanged()
    {
        var vm = new TestViewModel { Count = 10 };
        var firedCount = 0;

        vm.PropertyChanged += (_, _) => firedCount++;

        vm.Count = 10;

        Assert.Equal(0, firedCount);
    }

    [Fact]
    public void PropertyChanged_Fires_WithCorrectPropertyName()
    {
        var vm = new TestViewModel();
        string? capturedName = null;

        vm.PropertyChanged += (_, args) => capturedName = args.PropertyName;

        vm.Name = "hello";

        Assert.Equal(nameof(TestViewModel.Name), capturedName);
    }

    [Fact]
    public void PropertyChanged_CanSubscribeAndUnsubscribe()
    {
        var vm = new TestViewModel();
        var firedCount = 0;

        void Handler(object? sender, PropertyChangedEventArgs e) => firedCount++;

        vm.PropertyChanged += Handler;
        vm.Name = "first";
        Assert.Equal(1, firedCount);

        vm.PropertyChanged -= Handler;
        vm.Name = "second";
        Assert.Equal(1, firedCount);
    }

    [Fact]
    public void SetField_AssignsValue_WhenChanged()
    {
        var vm = new TestViewModel();

        vm.Name = "initial";
        Assert.Equal("initial", vm.Name);

        vm.Name = "updated";
        Assert.Equal("updated", vm.Name);
    }
}
