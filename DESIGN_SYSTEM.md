# 🎨 Aayam OMS - Design System Reference

**Quick reference for developers - Full guidelines in `/brain/DESIGN_SYSTEM.md`**

## Color Palette

```tsx
Primary Blue:    #0000FF  // Actions, links, active states
Accent Orange:   #FF6600  // Urgent, attention, alerts
Dark Grey:       #3A3F4F  // Structure, sidebar, primary text
Light Grey:      #D5D5D6  // Secondary areas, disabled
White:           #FFFFFF  // Main surfaces
```

## Typography

```tsx
Page Title:      text-xl font-semibold      // 20px, 600
Section Heading: text-base font-semibold    // 16px, 600
Body Text:       text-sm                    // 14px, 400
Small Labels:    text-xs                    // 12px, 400
Buttons:         text-sm font-medium        // 14px, 500
```

## Buttons

```tsx
// Primary
<button className="bg-[#0000FF] text-white px-4 py-2 rounded-xl font-medium">Save</button>

// Secondary
<button className="border-2 border-[#0000FF] text-[#0000FF] px-4 py-2 rounded-xl">Cancel</button>

// Attention
<button className="bg-[#FF6600] text-white px-4 py-2 rounded-xl font-medium">Delete</button>
```

## Status Badges

```tsx
// Completed/Approved
<span className="px-3 py-1 rounded-full bg-[#0000FF] text-white text-xs font-medium">Completed</span>

// Action Needed
<span className="px-3 py-1 rounded-full bg-[#FF6600] text-white text-xs font-medium">Action Needed</span>

// Draft/Neutral
<span className="px-3 py-1 rounded-full bg-[#D5D5D6] text-[#3A3F4F] text-xs font-medium">Draft</span>
```

## Spacing (8px grid)

```tsx
p-2  = 8px
p-4  = 16px
p-6  = 24px
p-8  = 32px
p-10 = 40px
```

## Text Colors

```tsx
text-[#3A3F4F]  // Primary text
text-[#6B6F7A]  // Secondary text
text-white      // On dark surfaces
text-[#9AA0A6]  // Disabled
```

---

**See full design system:** `/brain/DESIGN_SYSTEM.md`
