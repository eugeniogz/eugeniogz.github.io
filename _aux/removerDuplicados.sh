#!/bin/bash

# Function to compare file content
compare_files() {
    diff "$1" "$2" >/dev/null
    return $?
}

# Find all files in current directory and subdirectories
find . -type f -name "*.md" | while read -r filepath; do
    filename=$(basename "$filepath")
    dirname=$(dirname "$filepath")

    # Check if the filename matches the pattern " (number)"
    if [[ "$filename" =~ ^(.*)\ \([0-9]+\)(\..*)?$ ]]; then
        base_name="${BASH_REMATCH[1]}"
        extension="${BASH_REMATCH[2]}"

        original_filepath="$dirname/$base_name$extension"

        # Check if the original file exists
        if [[ -f "$original_filepath" ]]; then
            if compare_files "$filepath" "$original_filepath"; then
                rm "$filepath"
            else
                echo "Compared '$filepath' with '$original_filepath'..."
                echo "Files are different. Keeping both."
            fi
        fi
    fi
done

echo "Duplicate removal process completed."
