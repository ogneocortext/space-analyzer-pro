using System;
using System.Text.Json;
using System.Text.Json.Serialization;

public class TestResult
{
    public long TotalFiles { get; set; }
    public string Path { get; set; } = string.Empty;
}

public class Program
{
    public static void Main()
    {
        var json = @"{""total_files"": 7607, ""path"": ""C:\\Users""}";
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        };
        try
        {
            var result = JsonSerializer.Deserialize<TestResult>(json, options);
            Console.WriteLine($"TotalFiles: {result.TotalFiles}, Path: {result.Path}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}
