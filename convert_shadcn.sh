#!/bin/bash
# Systematic Shadcn conversion script for Jobs page
# This applies ALL the conversion patterns from the implementation plan

FILE="/Users/satish/Desktop/01 PROJECT/OFFICE SYSTEM 2/aayam-office-2/app/admin/jobs/page.tsx"

echo "Starting Shadcn component conversion..."

# 1. Convert custom badges to <Badge> component
# Pattern: <div className="px-2.5 py-1 rounded-full text-xs..."> → <Badge>
sed -i '' 's/<div className={`px-2\.5 py-1 rounded-full text-xs font-semibold tracking-wide \${getPriorityBadge(job\.priority)}`}>/<Badge className={getPriorityBadge(job.priority)}>/g' "$FILE"
sed -i '' 's/<\/div>  *\/\/ Close priority badge/<\/Badge>/g' "$FILE"

# 2. Convert custom buttons to Button component with proper variants
# Ghost buttons (icon only)
sed -i '' 's/<button *onClick={(e) => { e\.stopPropagation(); handleEdit(job); }} *className="p-2 bg-white hover:bg-gray-100 text-gray-600 rounded-lg transition-colors" *title="Edit">/<Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(job); }} title="Edit">/g' "$FILE"

# 3. Convert custom input fields to Input component
sed -i '' 's/<input *type="text" *required *value/{formData\.project_name} *onChange={(e) => setFormData({ \.\.\.formData, project_name: e\.target\.value })} *className="w-full px-3 py-2 border rounded-xl"/<Input type="text" required value={formData.project_name} onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}/g' "$FILE"

echo "Conversion complete! Check the file for results."
