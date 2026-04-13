# BetterU Badge System - Implementation Guide

## Overview

The badge system is now fully implemented in the database! This document explains how it works and how to use it.

## ✅ What's Been Created

### Database Tables
1. **`badge_definitions`** - Stores all available badge types and their criteria
2. **`user_badges`** - Tracks which badges each user has earned
3. **`profiles.displayed_badge_id`** - Quick reference for currently displayed badge

### Automatic Badge Awarding
Badges are automatically awarded via database triggers when:
- ✅ User completes a workout → checks workout count badges
- ✅ User completes a mental session → checks mental session badges
- ✅ User's streak updates → checks streak badges
- ✅ User's team league changes → checks league badges
- ✅ New user signs up → checks founding member badge

### Badge Types Included

#### Streak Badges
- **10 Day Streak** - "Getting Started"
- **25 Day Streak** - "Building Momentum"
- **50 Day Streak** - "Half Century"
- **100 Day Streak** - "Centurion"
- **365 Day Streak** - "Year Warrior"

#### Workout Badges
- **10 Workouts** - "Getting Started"
- **50 Workouts** - "Building Momentum"
- **100 Workouts** - "Centurion"
- **500 Workouts** - "Fitness Veteran"
- **1000 Workouts** - "Fitness Legend"

#### Mental Session Badges
- **10 Sessions** - "Mindful Beginner"
- **50 Sessions** - "Mindful Explorer"
- **100 Sessions** - "Mindful Master"
- **500 Sessions** - "Zen Master"

#### Special Badges
- **Founding Member** - For users who signed up within 3 months of app release (Nov 23, 2024 - Feb 23, 2025)

#### League Badges
- **Bronze League** - Team reached Bronze League
- **Silver League** - Team reached Silver League
- **Gold League** - Team reached Gold League
- **Platinum League** - Team reached Platinum League
- **Diamond League** - Team reached Diamond League
- **Master League** - Team reached Master League

## 🚀 How to Use the SQL Migration

1. **Open Supabase SQL Editor**
2. **Copy and paste** the entire contents of `supabase/migrations/20250122000000_create_badge_system.sql`
3. **Run the migration** - This will:
   - Create all tables
   - Set up RLS policies
   - Create functions and triggers
   - Seed badge definitions
   - Backfill badges for existing users

## 📱 Frontend Integration (Next Steps)

### 1. Display Badge on Profile

To show a user's displayed badge on their profile:

```javascript
// Fetch displayed badge
const { data: badgeData } = await supabase
  .from('profiles')
  .select(`
    displayed_badge_id,
    badge_definitions:displayed_badge_id (
      id,
      name,
      description,
      how_to_earn,
      icon_url
    )
  `)
  .eq('id', userId)
  .single();
```

### 2. Get All User Badges

```javascript
// Get all badges for a user
const { data: badges } = await supabase
  .rpc('get_user_badges', { p_user_id: userId });
```

### 3. Change Displayed Badge

```javascript
// Set a new displayed badge
const { data, error } = await supabase
  .rpc('set_displayed_badge', {
    p_user_id: userId,
    p_badge_id: badgeId
  });
```

### 4. Badge Modal Component

You'll need to create a `BadgeModal` component that:
- Shows badge icon, name, description
- Shows "How to Earn" information
- Can be opened by clicking any badge (yours or others')
- Displays when the badge was earned

## 🎨 Badge Icons

**Note:** You'll need to create badge icon images. Recommended:
- Store in `assets/images/badges/` or Supabase Storage
- Size: 128x128px (PNG with transparency)
- Naming: `badge_{badge_key}.png` (e.g., `badge_streak_10.png`)
- Update `icon_url` in `badge_definitions` table after adding icons

## 🔧 Key Database Functions

### `check_and_award_badge(user_id, badge_key)`
Manually check and award a specific badge to a user.

### `check_all_badges_for_user(user_id)`
Check all badge types for a user (useful for backfilling).

### `set_displayed_badge(user_id, badge_id)`
Set which badge a user displays (only one at a time).

### `get_user_badges(user_id)`
Get all badges for a user with full details.

## 🔒 Security (RLS Policies)

- ✅ **Everyone can view** badge definitions and user badges (public visibility)
- ✅ **Only system** can award badges (via triggers/functions)
- ✅ **Users can change** their own displayed badge
- ✅ **Service role** can modify badge definitions (for admin)

## 📊 Example Queries

### Get User's Displayed Badge
```sql
SELECT 
  bd.id,
  bd.name,
  bd.description,
  bd.how_to_earn,
  bd.icon_url,
  ub.earned_at
FROM profiles p
JOIN badge_definitions bd ON p.displayed_badge_id = bd.id
JOIN user_badges ub ON ub.badge_id = bd.id AND ub.user_id = p.id
WHERE p.id = 'user-uuid-here';
```

### Get All Badges for User
```sql
SELECT * FROM get_user_badges('user-uuid-here');
```

### Get Badge Collection Stats
```sql
SELECT 
  COUNT(*) as total_badges,
  COUNT(*) FILTER (WHERE is_displayed = true) as displayed_badge_count
FROM user_badges
WHERE user_id = 'user-uuid-here';
```

## 🎯 Badge Modal Requirements

When a user clicks on a badge (their own or someone else's), show a modal with:

1. **Badge Icon** - Large display of the badge image
2. **Badge Name** - e.g., "10 Day Streak"
3. **Description** - What the badge represents
4. **How to Earn** - How the user earned/will earn this badge
5. **Earned Date** - When the badge was earned (if viewing someone else's badge, show "Earned on [date]")
6. **Close Button** - To dismiss the modal

## 🔄 Automatic Badge Checking

The system automatically checks for badges when:
- ✅ Streak updates (via `user_streaks` trigger)
- ✅ Workout completed (via `user_workout_logs` trigger)
- ✅ Mental session completed (via `mental_session_logs` trigger)
- ✅ Team league changes (via `teams` trigger)
- ✅ New user signs up (via `profiles` trigger)

**No manual intervention needed!** Badges are awarded automatically.

## 🐛 Troubleshooting

### Badge Not Awarded?
1. Check if badge definition exists: `SELECT * FROM badge_definitions WHERE badge_key = 'streak_10';`
2. Check user's current stats: `SELECT * FROM user_stats WHERE profile_id = 'user-id';`
3. Manually check badge: `SELECT * FROM check_and_award_badge('user-id', 'streak_10');`

### Change Displayed Badge Not Working?
- Ensure user actually has the badge: `SELECT * FROM user_badges WHERE user_id = 'user-id' AND badge_id = 'badge-id';`
- Check RLS policies are correct

### Founding Member Badge
- App release: **November 23, 2024**
- Cutoff date: **February 23, 2025** (3 months later)
- To change, update `v_app_release_date` in `check_and_award_badge` function

## 📝 Next Steps

1. ✅ **SQL Migration** - Already created, ready to run
2. ⏳ **Create Badge Icons** - Design and add badge images
3. ⏳ **Badge Display Component** - Show badge on profile
4. ⏳ **Badge Modal Component** - Show badge details when clicked
5. ⏳ **Badge Collection Page** - Let users view and change displayed badge
6. ⏳ **Badge Notifications** - Optional: Notify users when they earn badges

## 🎉 You're All Set!

The database is ready! Just run the SQL migration and start building the UI components. The badge system will automatically award badges as users complete activities.

