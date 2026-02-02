#!/bin/bash

# Density Rules Bulk Application Script
# Applies all 7 density rules to remaining pages

echo "🎯 Starting Bulk Density Optimization..."
echo "=================================="

# Counter for files modified
FILES_MODIFIED=0

# Find all page.tsx files in app/admin
PAGES=$(find app/admin -name "page.tsx" -type f)

for PAGE in $PAGES; do
    # Create backup
    cp "$PAGE" "$PAGE.bak"
    
    CHANGED=false
    
    # Rule #1 & #2: Reduce padding and gaps
    # p-6 → p-4 (but not in modals which might need more padding)
    if grep -q "p-6" "$PAGE"; then
        sed -i '' 's/p-6/p-4/g' "$PAGE"
        CHANGED=true
    fi
    
    # md:p-6 → md:p-4
    if grep -q "md:p-6" "$PAGE"; then
        sed -i '' 's/md:p-6/md:p-4/g' "$PAGE"
        CHANGED=true
    fi
    
    # lg:p-8 → remove (already have md:p-4)
    if grep -q "lg:p-8" "$PAGE"; then
        sed -i '' 's/ lg:p-8//g' "$PAGE"
        CHANGED=true
    fi
    
    # gap-6 → gap-4
    if grep -q "gap-6" "$PAGE"; then
        sed -i '' 's/gap-6/gap-4/g' "$PAGE"
        CHANGED=true
    fi
    
    # md:gap-6 → md:gap-4  
    if grep -q "md:gap-6" "$PAGE"; then
        sed -i '' 's/md:gap-6/md:gap-4/g' "$PAGE"
        CHANGED=true
    fi
    
    # lg:gap-8 → remove (already have gap-4)
    if grep -q "lg:gap-8" "$PAGE"; then
        sed -i '' 's/ lg:gap-8//g' "$PAGE"
        CHANGED=true
    fi
    
    # md:gap-8 → md:gap-4
    if grep -q "md:gap-8" "$PAGE"; then
        sed -i '' 's/md:gap-8/md:gap-4/g' "$PAGE"
        CHANGED=true
    fi
    
    # Rule #5: Header margins
    # mb-6 → mb-1.5
    if grep -q "mb-6" "$PAGE"; then
        sed -i '' 's/mb-6/mb-1.5/g' "$PAGE"
        CHANGED=true
    fi
    
    # md:mb-6 → mb-1.5 (remove responsive variant, use consistent)
    if grep -q "md:mb-6" "$PAGE"; then
        sed -i '' 's/md:mb-6/mb-1.5/g' "$PAGE"
        CHANGED=true
    fi
    
    # mb-8 → mb-1.5
    if grep -q "mb-8" "$PAGE"; then
        sed -i '' 's/mb-8/mb-1.5/g' "$PAGE"
        CHANGED=true
    fi
    
    # md:mb-8 → mb-1.5
    if grep -q "md:mb-8" "$PAGE"; then
        sed -i '' 's/md:mb-8/mb-1.5/g' "$PAGE"
        CHANGED=true
    fi
    
    if [ "$CHANGED" = true ]; then
        FILES_MODIFIED=$((FILES_MODIFIED + 1))
        echo "✅ Modified: $PAGE"
    fi
done

echo "=================================="
echo "📊 Summary:"
echo "   Files modified: $FILES_MODIFIED"
echo ""
echo "💾 Backups created with .bak extension"
echo "🧪 Test the changes and remove backups if satisfied"
echo ""
echo "To remove backups: find app/admin -name '*.bak' -delete"
echo "✨ Done!"
