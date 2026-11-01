import os

# ==========================================
# Configuration
# ==========================================

OUTPUT_FILE = "project_contents.txt"

# Name of this script (so it doesn't include itself)
THIS_SCRIPT = os.path.basename(__file__)

# Directories to skip completely
SKIP_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    ".github",
    ".idea",
    ".vscode",
    "venv",
    ".venv",
    "env",
    ".env",
    "Lib",          # Windows virtual environment libraries
    "libs",
    "site-packages",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache"
}

# Files to skip
SKIP_FILES = {
    THIS_SCRIPT,
    OUTPUT_FILE,
    "package-lock.json"
}

# Binary extensions to skip
SKIP_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".rar",
    ".7z",
    ".gz",
    ".tar",
    ".exe",
    ".dll",
    ".so",
    ".pyd",
    ".pyc",
    ".pyo",
    ".mp3",
    ".wav",
    ".ogg",
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".webm",
    ".ttf",
    ".otf",
    ".woff",
    ".woff2"
}


# ==========================================
# Export
# ==========================================

with open(OUTPUT_FILE, "w", encoding="utf-8") as out:

    out.write("=" * 80 + "\n")
    out.write("PROJECT FILE EXPORT\n")
    out.write("=" * 80 + "\n\n")

    for root, dirs, files in os.walk("."):

        # Skip unwanted folders
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in sorted(files):

            if file in SKIP_FILES:
                continue

            ext = os.path.splitext(file)[1].lower()

            if ext in SKIP_EXTENSIONS:
                continue

            filepath = os.path.join(root, file)

            relative_path = os.path.relpath(filepath, ".")

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

            except UnicodeDecodeError:
                continue

            except Exception as e:
                content = f"Unable to read file.\nError: {e}"

            out.write("\n")
            out.write("=" * 100 + "\n")
            out.write(f"FILE: {relative_path}\n")
            out.write("=" * 100 + "\n\n")

            out.write(content)

            out.write("\n\n")

print(f"\nDone!")
print(f"Project exported to '{OUTPUT_FILE}'.")