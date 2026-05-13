# Admin "My Queue" Enhancement

## Overview
Enhanced the "My Queue" view in the Design Studio to intelligently show different content based on user role.

## Changes Made

### 1. Smart Filtering Logic
**File:** `app/admin/designers/tasks/page.tsx`

#### For Admin Users (System Monitor)
When an admin clicks "My Queue", they now see:
- ✅ **Unassigned Tasks** - Tasks that need to be assigned to designers
- ✅ **Tasks Needing Approval** - Jobs in 'approval' stage waiting for client feedback
- ✅ **Overdue Tasks** - Tasks past their deadline that aren't completed

#### For Designer Users
When a designer clicks "My Queue", they see:
- Their assigned tasks
- Unassigned tasks (they can pick up)

### 2. Visual Clarity
Added contextual subtitles below the "My Queue" header:
- **Admin:** "Unassigned + Needs Attention + Overdue"
- **Designer:** "Your assigned tasks"

## Logic Implementation

```typescript
// Admin My Queue Logic
const needsAdminAttention = isAdmin && (
  !task.designerId ||                    // Unassigned tasks
  task.current_stage === 'approval' ||   // Waiting for client approval
  (task.rawDeadline && new Date(task.rawDeadline) < new Date() && task.status !== 'completed') // Overdue
);

// View Matching
if (activeTab === 'my_tasks') {
  if (isAdmin) {
    matchesView = needsAdminAttention; // Admin sees tasks needing attention
  } else {
    matchesView = isAssignedToMe || !task.designerId; // Designers see their tasks
  }
}
```

## Benefits

### For Admin
1. **Quick Overview** - Immediately see what needs attention
2. **Resource Management** - Easily identify unassigned work
3. **Quality Control** - Track approval-stage and overdue items
4. **Efficient Monitoring** - All critical items in one view

### For Designers
- Unchanged behavior - see their assigned work

## Testing Checklist

- [ ] Login as Admin → Navigate to Design Studio → Click "My Queue"
- [ ] Verify unassigned tasks are shown
- [ ] Verify tasks in 'approval' stage are shown
- [ ] Verify overdue tasks are shown
- [ ] Verify subtitle says "Unassigned + Needs Attention + Overdue"
- [ ] Login as Designer → Navigate to Design Studio → Click "My Queue"
- [ ] Verify only assigned tasks are shown
- [ ] Verify subtitle says "Your assigned tasks"

## Future Enhancements

Consider adding:
- Badge count in sidebar for tasks needing admin attention
- Color coding for different attention types (unassigned vs overdue)
- Filter toggles to show/hide specific categories
- Payment-related blockers (if integrated with finance module)
