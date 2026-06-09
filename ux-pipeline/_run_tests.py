import subprocess, sys
result = subprocess.run(
    [sys.executable, "-m", "pytest", "tests", "-v", "--tb=short"],
    cwd=r"E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline",
    capture_output=True, text=True,
)
print("RC:", result.returncode)
print("STDOUT:")
print(result.stdout)
print("STDERR:")
print(result.stderr)
