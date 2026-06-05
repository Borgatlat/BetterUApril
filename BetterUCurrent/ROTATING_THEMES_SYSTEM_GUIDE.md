# Rotating Themes System - Complete Guide

## Overview

This system allows you to:
- ✅ Add themes remotely via Cloudinary/Google Drive links (no app updates needed)
- ✅ Rotate 5 themes weekly for each user
- ✅ Assign randomized rarities per user per slot (50% common, 30% rare, 15% epic, 4.9% legendary, 0.1% mythic)
- ✅ Update pricing and themes without code changes

---

## Database Tables

### 1. `theme_bank`
**Purpose**: Stores all available themes that can be rotated

**Key Fields**:
- `name`: Display name (e.g., "Cosmic Purple")
- `theme_key`: Unique identifier (e.g., "cosmic_purple_001")
- `image_url`: Full URL to theme image (Cloudinary or Google Drive)
- `background_color`: Hex color for fallback
- `gradient_colors`: Array of gradient colors
- `rarity`: Base rarity (common, rare, epic, legendary, mythic)
- `is_rotating`: Whether this theme can appear in rotations

### 2. `theme_rotations`
**Purpose**: Tracks weekly rotation periods

**Key Fields**:
- `week_start_date`: Start of rotation week (typically Monday)
- `week_end_date`: End of rotation week (typically Sunday)
- `rotation_number`: Sequential rotation number
- `is_active`: Current active rotation

### 3. `user_theme_slots`
**Purpose**: Stores which 5 themes each user sees per rotation

**Key Fields**:
- `user_id`: The user
- `rotation_id`: Which rotation week
- `slot_number`: Slot 1-5
- `theme_id`: Which theme from theme_bank
- `slot_rarity`: **Randomized rarity for this user's slot** (this is what makes it different per user!)
- `neuros_cost`: Cost based on slot_rarity

### 4. `rarity_pricing`
**Purpose**: Defines pricing for each rarity level

**Key Fields**:
- `rarity`: common, rare, epic, legendary, mythic
- `neuros_cost`: Base cost for this rarity

---

## How It Works

### Weekly Rotation Flow

1. **Create Rotation** (Weekly, typically Sunday night/Monday morning)
   ```sql
   INSERT INTO theme_rotations (week_start_date, week_end_date, rotation_number, is_active)
   VALUES 
     (CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', 
      (SELECT COALESCE(MAX(rotation_number), 0) + 1 FROM theme_rotations), 
      true);
   ```

2. **Deactivate Old Rotation**
   ```sql
   UPDATE theme_rotations SET is_active = false WHERE is_active = true AND id != 'new_rotation_id';
   ```

3. **Assign Themes to Users** (Automated or manual)
   - When a user opens the store, check if they have slots for current rotation
   - If not, call `assign_user_theme_slots(user_id, rotation_id)`
   - This function randomly assigns 5 themes with randomized rarities

### Rarity Distribution Per Slot

Each user's 5 slots get randomized rarities:
- **50%** chance = `common`
- **30%** chance = `rare`
- **15%** chance = `epic`
- **4.9%** chance = `legendary`
- **0.1%** chance = `mythic`

**Example**: User A might get: common, rare, common, epic, common
User B might get: rare, legendary, common, rare, common

---

## How to Add Themes Remotely

### Step 1: Upload Image to Cloudinary or Google Drive

**Cloudinary**:
1. Upload image to Cloudinary
2. Get the URL (e.g., `https://res.cloudinary.com/your-cloud/image/upload/v1234567890/theme_name.jpg`)

**Google Drive**:
1. Upload image to Google Drive
2. Right-click → Share → Anyone with link
3. Get shareable link, convert to direct image URL:
   - Original: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
   - Direct: `https://drive.google.com/uc?export=download&id=FILE_ID`

### Step 2: Add Theme to Database

```sql
INSERT INTO theme_bank (
  name,
  theme_key,
  image_url,
  background_color,
  gradient_colors,
  rarity,
  neuros_cost,
  description,
  is_active,
  is_rotating
) VALUES (
  'Cosmic Purple',                    -- Display name
  'cosmic_purple_001',                -- Unique key
  'https://res.cloudinary.com/...',   -- Image URL
  '#4a0e4e',                          -- Background color
  ARRAY['#4a0e4e', '#1a0a1e'],       -- Gradient colors
  'epic',                             -- Base rarity
  50,                                 -- Base cost
  'A mysterious purple theme',        -- Description
  true,                               -- Active
  true                                -- Can rotate
);
```

### Step 3: Theme Appears in Next Rotation

The theme will automatically be available for the next rotation assignment!

---

## How to Create Weekly Rotation

### Manual Process (via Supabase Dashboard or SQL)

```sql
-- 1. Get next rotation number
SELECT COALESCE(MAX(rotation_number), 0) + 1 AS next_rotation 
FROM theme_rotations;

-- 2. Create new rotation (Monday to Sunday)
INSERT INTO theme_rotations (week_start_date, week_end_date, rotation_number, is_active)
VALUES 
  (
    DATE_TRUNC('week', CURRENT_DATE)::DATE,  -- This Monday
    DATE_TRUNC('week', CURRENT_DATE)::DATE + INTERVAL '6 days',  -- This Sunday
    (SELECT COALESCE(MAX(rotation_number), 0) + 1 FROM theme_rotations),
    true
  )
RETURNING id;

-- 3. Deactivate old rotation
UPDATE theme_rotations 
SET is_active = false 
WHERE is_active = true 
  AND id != (SELECT id FROM theme_rotations WHERE is_active = true ORDER BY rotation_number DESC LIMIT 1);
```

### Automated Process (Supabase Edge Function or Cron)

Create a Supabase Edge Function that runs weekly (Sunday night) to:
1. Create new rotation
2. Deactivate old rotation
3. Optionally pre-assign themes to active users

---

## How Users Get Their 5 Themes

### Option 1: Lazy Assignment (Recommended)
When user opens store:
1. Check if they have slots for current rotation
2. If not, call `assign_user_theme_slots(user_id, current_rotation_id)`
3. Display their 5 themes

**SQL Query**:
```sql
-- Get current rotation
SELECT get_current_rotation();

-- Check if user has slots
SELECT COUNT(*) FROM user_theme_slots 
WHERE user_id = 'user_id' 
  AND rotation_id = get_current_rotation();

-- If 0, assign slots
SELECT assign_user_theme_slots('user_id', get_current_rotation());
```

### Option 2: Pre-assignment
When rotation starts, assign themes to all active users:
```sql
-- Get all active users
-- For each user, call assign_user_theme_slots(user_id, rotation_id)
```

---

## Updating Rarity Pricing

Update pricing for any rarity level:

```sql
UPDATE rarity_pricing 
SET neuros_cost = 150 
WHERE rarity = 'legendary';
```

This affects all future slot assignments!

---

## Querying User's Current Themes

```sql
SELECT 
  uts.slot_number,
  uts.slot_rarity,
  uts.neuros_cost,
  tb.name AS theme_name,
  tb.image_url,
  tb.background_color,
  tb.gradient_colors
FROM user_theme_slots uts
JOIN theme_bank tb ON uts.theme_id = tb.id
WHERE uts.user_id = 'user_id'
  AND uts.rotation_id = get_current_rotation()
ORDER BY uts.slot_number;
```

---

## Important Notes

1. **Theme Keys Must Be Unique**: Each theme needs a unique `theme_key`
2. **Image URLs**: Must be publicly accessible (Cloudinary or Google Drive direct links)
3. **Rarity Randomization**: Happens per user per slot - same theme can have different rarities for different users
4. **Pricing**: Based on `slot_rarity`, not theme's base rarity
5. **Rotation Timing**: Typically Monday 00:00 to Sunday 23:59
6. **Old Rotations**: Keep historical data for analytics, but only current rotation is active

---

## Example: Complete Workflow

### Week 1: Add New Theme
```sql
-- Add theme to bank
INSERT INTO theme_bank (name, theme_key, image_url, background_color, gradient_colors, rarity, is_active, is_rotating)
VALUES ('Neon Dreams', 'neon_dreams_001', 'https://cloudinary.com/...', '#00ffff', ARRAY['#00ffff', '#ff00ff'], 'rare', true, true);
```

### Week 2: Create Rotation
```sql
-- Create rotation for this week
INSERT INTO theme_rotations (week_start_date, week_end_date, rotation_number, is_active)
VALUES (DATE_TRUNC('week', CURRENT_DATE)::DATE, DATE_TRUNC('week', CURRENT_DATE)::DATE + 6, 1, true);
```

### Week 2: User Opens Store
- App checks: Does user have slots for current rotation? No.
- App calls: `assign_user_theme_slots(user_id, rotation_id)`
- User sees 5 themes with randomized rarities!

---

## Next Steps for App Integration

1. **Update Store Screen**: Fetch user's current rotation themes instead of all themes
2. **Display Logic**: Show themes from `user_theme_slots` with `slot_rarity` badges
3. **Purchase Logic**: When user purchases, add to `purchased_themes` array in profiles
4. **Rotation Check**: On app open, check if new rotation started, assign if needed

---

## Summary

✅ **4 New Tables**: `theme_bank`, `theme_rotations`, `user_theme_slots`, `rarity_pricing`
✅ **2 Helper Functions**: `get_current_rotation()`, `assign_user_theme_slots()`
✅ **Remote Theme Addition**: Just insert into `theme_bank` with image URL
✅ **Weekly Rotations**: Create rotation, assign themes per user
✅ **Randomized Rarities**: Each user gets different rarity slots per week

No code changes needed to add themes - just database inserts! 🎉
