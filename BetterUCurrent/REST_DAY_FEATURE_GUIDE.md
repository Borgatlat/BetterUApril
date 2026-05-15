# 🛌 Rest Day Feature & Today Indicator Updates

## ✨ What's New

### 1. **Rest Day Functionality** 🛌
Users can now mark days as "Rest Days" in addition to scheduling workouts!

### 2. **Updated Today Indicator** 📅
Today's date now shows a subtle "TODAY" badge without the full highlight, unless there's a workout or rest day scheduled.

---

## 🎨 Visual Changes

### Calendar Appearance:

**Regular Days:**
- White text
- Light gray background
- Thin gray border

**Today (no schedule):**
- White text
- Small "TODAY" badge at top
- Same background as regular days

**Workout Days:**
- **Cyan highlight** (`#00ffff`)
- Cyan text (bold)
- Thicker cyan border
- Brighter cyan background

**Rest Days:**
- **Orange highlight** (`#ffa500`)
- Orange text (bold)
- Thicker orange border
- Orange-tinted background

---

## 🗄️ Database Changes

**IMPORTANT**: You need to run the updated SQL again!

### New Fields Added:
```sql
is_rest_day BOOLEAN DEFAULT FALSE
```

### Updated Constraints:
- `workout_name` is now nullable (for rest days)
- `workout_exercises` defaults to empty array
- CHECK constraint ensures rest days don't have workout data
- One entry per user per day (either workout OR rest day)

### How to Update:
1. **DROP the old table first** (if you already created it):
   ```sql
   DROP TABLE IF EXISTS scheduled_workouts CASCADE;
   ```
2. Run the updated `scheduled_workouts_table.sql` file
3. All RLS policies will be recreated

---

## 📱 User Experience

### Scheduling a Rest Day:

**Option 1: From Empty Day**
1. Tap any unscheduled day
2. Modal opens showing workout list
3. Scroll to bottom
4. See "OR" divider
5. Tap "Mark as Rest Day" button
6. Day turns orange on calendar

**Option 2: From Scheduled Workout**
1. Tap day with workout scheduled
2. See workout details
3. Bottom row has 3 buttons: Change | **Rest Day** | Delete
4. Tap "Rest Day" button
5. Workout replaced with rest day
6. Day turns orange on calendar

### Viewing a Rest Day:

1. Tap orange day on calendar
2. Modal shows rest day card with:
   - Bed icon
   - "Recovery Day" title
   - Motivational message about recovery
   - Notes (if any)
3. Two options:
   - "Schedule Workout Instead" - Replace with workout
   - "Remove" - Delete the rest day

### Switching Between States:

**Workout → Rest Day:**
- Old workout is deleted
- Rest day entry created
- Day changes from cyan to orange

**Rest Day → Workout:**
- Rest day is deleted
- New workout entry created
- Day changes from orange to cyan

**Rest Day → Empty:**
- Rest day deleted
- Day returns to default appearance

---

## 🎨 Color Coding

| State | Background | Border | Text | Meaning |
|-------|-----------|--------|------|---------|
| Empty | Gray | Gray | White | No schedule |
| Today | Gray | Gray | White + Badge | Current day |
| Workout | Cyan tint | Cyan (2px) | Cyan Bold | Workout scheduled |
| Rest Day | Orange tint | Orange (2px) | Orange Bold | Rest day marked |

---

## 🔧 Technical Implementation

### Calendar Component Updates:

```javascript
const scheduled = scheduledWorkouts[dateStr];
const isRestDay = scheduled?.is_rest_day;
const hasWorkout = scheduled && !isRestDay;

// Apply different styles
style={[
  styles.dayCell,
  hasWorkout && styles.hasWorkoutCell,    // Cyan
  isRestDay && styles.restDayCell,        // Orange
]}
```

### Helper Function Added:

```javascript
export const addRestDay = async (userId, date, notes = 'Rest day') => {
  return addScheduledWorkout(userId, date, {
    is_rest_day: true,
    notes: notes
  });
};
```

### Modal View Modes:

- `'existing'` - Show scheduled workout
- `'rest'` - Show rest day info
- `'choose'` - Show workout list + rest day option

---

## 💡 Why Rest Days Matter

**Educational Message in Modal:**
> "Taking a rest day is important for muscle recovery and preventing injury."

This helps users understand that rest is part of training, not skipping training!

---

## 🎯 Key Features

✅ **Visual Distinction**
- Clear color coding (cyan = workout, orange = rest)
- Easy to see schedule at a glance

✅ **Flexible Scheduling**
- Can switch between workout/rest/empty
- No duplicate entries per day

✅ **Educational**
- Encourages proper recovery
- Normalizes rest as part of fitness

✅ **Professional UI**
- Bed icon for rest days
- Card-based layout
- Clear action buttons

---

## 📊 Use Cases

### 1. **Weekly Training Split**
```
Mon: Upper Body (Cyan)
Tue: Lower Body (Cyan)
Wed: Rest Day (Orange)
Thu: Full Body (Cyan)
Fri: Cardio (Cyan)
Sat: Rest Day (Orange)
Sun: Active Recovery (Orange)
```

### 2. **Recovery After Injury**
Mark multiple rest days while recovering

### 3. **Deload Week**
Reduce workout frequency, add more rest days

### 4. **Vacation Planning**
Mark travel days as rest days in advance

---

## 🔄 Update Process

### For Existing Users:

**If you already ran the old SQL:**
1. Backup any data (if needed)
2. Run `DROP TABLE scheduled_workouts CASCADE;`
3. Run the new `scheduled_workouts_table.sql`
4. Table recreated with rest day support

**If you haven't run SQL yet:**
1. Just run `scheduled_workouts_table.sql` once
2. You're all set!

---

## 🎨 Styling Details

### Rest Day Card Styling:
```javascript
backgroundColor: 'rgba(255, 165, 0, 0.08)',  // Orange tint
borderColor: 'rgba(255, 165, 0, 0.25)',       // Orange border
```

### Rest Day Calendar Cell:
```javascript
backgroundColor: 'rgba(255, 165, 0, 0.15)',   // Brighter orange tint
borderColor: '#ffa500',                        // Solid orange border
borderWidth: 2,                                // Thick border
```

### Workout Calendar Cell:
```javascript
backgroundColor: 'rgba(0, 255, 255, 0.15)',   // Cyan tint
borderColor: '#00ffff',                        // Solid cyan border
borderWidth: 2,                                // Thick border
```

---

## 📝 Notes

### Database Validation:
The CHECK constraint ensures data integrity:
- Rest days CANNOT have workout_name or exercises
- Workouts MUST have workout_name
- Each day can only be ONE type (workout or rest, not both)

### Future Enhancements:
Possible additions:
- Custom rest day types (active recovery, complete rest, etc.)
- Rest day reminders
- Rest day streaks
- Integration with workout streak tracking

---

## ✅ Testing Checklist

- [ ] Calendar shows today with badge (no highlight if empty)
- [ ] Can mark empty day as rest day
- [ ] Rest day appears orange on calendar
- [ ] Can tap orange day to view rest day details
- [ ] Can convert workout to rest day
- [ ] Can convert rest day to workout
- [ ] Can delete rest day
- [ ] Orange/cyan colors clearly distinguished
- [ ] Modal displays proper view for rest days
- [ ] "Mark as Rest Day" button appears in workout list
- [ ] Database constraints prevent invalid data
- [ ] Today badge appears on all days (today)

---

## 🎉 Summary

Your workout calendar now supports proper training periodization with dedicated rest day tracking! Users can:

✅ Mark days as rest days (orange)  
✅ Schedule workouts (cyan)  
✅ See today clearly with badge  
✅ Switch between states easily  
✅ Learn about recovery importance  

The visual distinction makes weekly planning intuitive and encourages balanced training! 🏋️‍♂️💪🛌

