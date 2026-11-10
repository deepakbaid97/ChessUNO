using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Xunit;

namespace Api.Tests;

public class SecretScanningTests
{
    private static readonly string[] DangerousPatterns = new[]
    {
        @"Password=(?!YOUR_POSTGRES_PASSWORD_HERE|secret|test|postgres|\$|\{|<)[^;""\s]+",
        @"ghp_[a-zA-Z0-9]{36}",
        @"BEGIN (RSA|EC|DSA|OPENSSH|PRIVATE) KEY"
    };

    [Fact]
    public void TrackedConfigFilesAndSource_DoNotContainExposedDatabasePasswords()
    {
        var baseDir = AppContext.BaseDirectory;
        var projectRoot = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", ".."));

        var extensionsToScan = new[] { ".json", ".cs", ".ts", ".svelte", ".md", ".yml", ".yaml" };
        var ignoreDirs = new[] { "bin", "obj", "node_modules", ".git", ".svelte-kit", "dist" };

        var files = Directory.EnumerateFiles(projectRoot, "*.*", SearchOption.AllDirectories)
            .Where(f => extensionsToScan.Contains(Path.GetExtension(f).ToLowerInvariant()))
            .Where(f => !f.EndsWith("SecretScanningTests.cs", StringComparison.OrdinalIgnoreCase))
            .Where(f => !ignoreDirs.Any(d => f.Contains(Path.DirectorySeparatorChar + d + Path.DirectorySeparatorChar) || f.Contains("/" + d + "/")))
            .ToList();

        foreach (var file in files)
        {
            var content = File.ReadAllText(file);
            foreach (var pattern in DangerousPatterns)
            {
                var match = Regex.Match(content, pattern, RegexOptions.IgnoreCase);
                Assert.False(match.Success, $"Secret leak detected in file: {Path.GetRelativePath(projectRoot, file)}. Pattern matched: {pattern}");
            }
        }
    }
}
