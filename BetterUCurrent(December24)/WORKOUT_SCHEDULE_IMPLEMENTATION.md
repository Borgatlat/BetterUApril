# Weekly Workout Schedule Feature - Implementation Guide

## 📋 Overview

This feature allows users to schedule workouts for the week (Monday-Sunday only) and view their scheduled workout for today directly in the workout screen.

## 🗄️ Database Setup

### SQL File: `scheduled_workouts_table.sql`

**Run this SQL in your Supabase SQL Editor to create the table and RLS policies:**

1. Log into your Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `scheduled_workouts_table.sql`
4. Click "Run" to execute

The SQL file creates:
- **Table**: `scheduled_workouts` with columns:
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key to auth.users)
  - `scheduled_date` (DATE)
  - `workout_name` (TEXT)
  - `workout_exercises` (JSONB)
  - `notes` (TEXT, optional)
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)
  
- **Unique Constraint**: One workout per user per day
- **Indexes**: For fast queries on user_id and scheduled_date
- **RLS Policies**: Users can only view/edit their own scheduled workouts
- **Trigger**: Auto-updates `updated_at` timestamp

### RLS Security

The Row Level Security (RLS) policies ensure:
- ✅ Users can only **SELECT** their own scheduled workouts
- ✅ Users can only **INSERT** workouts for themselves
- ✅ Users can only **UPDATE** their own scheduled workouts
- ✅ Users can only **DELETE** their own scheduled workouts

## 📁 Files Created

### 1. **Database Helpers** (`utils/scheduledWorkoutHelpers.js`)

**Purpose**: Provides functions to interact with the scheduled_workouts table

**Key Functions:**
```javascript
getScheduledWorkoutsForWeek(userId, startDate, endDate)
// Fetches all scheduled workouts for a user within a date range

getScheduledWorkoutForDate(userId, date)
// Gets a specific scheduled workout for a single date

addScheduledWorkout(userId, date, workoutData)
// Creates a new scheduled workout

updateScheduledWorkout(scheduledWorkoutId, workoutData)
// Updates an existing scheduled workout

deleteScheduledWorkout(scheduledWorkoutId)
// Deletes a scheduled workout

getCurrentWeekDates(date)
// Returns { startDate, endDate } for current week (Mon-Sun)

getWeekDaysArray(date)
// Returns array of 7 Date objects for the week

isSameDay(date1, date2)
// Checks if two dates are the same day
```

### 2. **Calendar Component** (`components/WeeklyWorkoutCalendar.js`)

**Purpose**: Displays a week view calendar with workout indicators

**Features:**
- Shows 7 days (Monday through Sunday)
- Highlights today's date
- Shows workout indicator (fitness icon) on days with scheduled workouts
- Interactive - tap any day to schedule/view/edit workout
- Refresh button to manually reload
- Auto-loads when user changes

**Props:**
- `onDayPress(date, existingWorkout)` - Callback when user taps a day
- Ref exposes `refresh()` method to reload calendar

**Usage Example:**
```javascript
const calendarRef = useRef(null);

<WeeklyWorkoutCalendar
  ref={calendarRef}
  onDayPress={(date, existingWorkout) => {
    // Open modal to add/view workout
  }}
/>

// To refresh calendar:
calendarRef.current.refresh();
```

### 3. **Scheduled Workout Modal** (`components/ScheduledWorkoutModal.js`)

**Purpose**: Modal for adding, viewing, editing, or deleting scheduled workouts

**Features:**
- Shows selected date at top
- If workout exists for that day:
  - Displays workout details (name, exercises, notes)
  - "Start Workout" button - launches workout immediately
  - "Remove" button - deletes from schedule
  - Option to change to a different workout
- If no workout exists:
  - Lists all user's custom workouts
  - Tap any workout to schedule it
- Prevents duplicate workouts (one per day per user)
- Handles loading states and errors gracefully

**Props:**
- `visible` (boolean) - Controls modal visibility
- `onClose()` - Callback when modal closes
- `selectedDate` (Date) - The date being scheduled
- `existingWorkout` (object|null) - Existing workout for that date (if any)
- `onWorkoutUpdated()` - Callback when workout is added/updated/deleted

## 🎨 Integration Points

### Home Screen (`app/(tabs)/home.js`)

**Location**: Near bottom of ScrollView, before closing tag

**What Was Added:**
1. Import statements for WeeklyWorkoutCalendar and ScheduledWorkoutModal
2. State variables:
   ```javascript
   const [showScheduledWorkoutModal, setShowScheduledWorkoutModal] = useState(false);
   const [selectedScheduledDate, setSelectedScheduledDate] = useState(null);
   const [selectedScheduledWorkout, setSelectedScheduledWorkout] = useState(null);
   const calendarRef = useRef(null);
   ```
3. Calendar component with modal at bottom of screen
4. Modal automatically opens when user taps a day

**Visual Result:**
- Calendar appears near bottom of home screen
- User can see entire week at a glance
- Days with workouts show a fitness icon
- Tapping opens the modal

### Workout Screen (`app/(tabs)/workout.js`)

**Location**: Top of workout list, before "Quick Actions"

**What Was Added:**
1. Import for `getScheduledWorkoutForDate` helper
2. State variable: `todayScheduledWorkout`
3. `fetchTodayScheduledWorkout()` function - loads today's workout
4. Scheduled workout section with prominent "SCHEDULED WORKOUT" header
5. Card showing workout details and "Start Scheduled Workout" button

**Visual Result:**
- If user has a workout scheduled for today, it appears at the very top
- Bright cyan accent color makes it stand out
- Clear "SCHEDULED WORKOUT" header so user knows it's for today
- One-tap to start the workout

## 🔄 Data Flow

### Scheduling a Workout:
1. User opens home screen → Calendar loads current week's workouts
2. User taps a day → Modal opens showing that date
3. User selects a workout from their list → Modal saves to database
4. Calendar refreshes automatically → Day now shows workout indicator

### Starting Today's Scheduled Workout:
1. User opens workout screen → `fetchTodayScheduledWorkout()` runs
2. If workout exists for today → Shows at top with special styling
3. User taps "Start Scheduled Workout" → Navigates to active-workout screen
4. Workout runs normally → User completes and logs it

### Editing/Deleting:
1. User taps calendar day with existing workout → Modal shows workout details
2. User can either:
   - Start it immediately (if it's scheduled for today/future)
   - Remove it from schedule
   - Replace with a different workout

## 🎯 Key Features

✅ **One Workout Per Day** - Unique constraint prevents conflicts
✅ **Visual Indicators** - Easy to see which days have workouts scheduled
✅ **Interactive Calendar** - Tap any day to manage workouts
✅ **Today's Workout Prominent** - Appears at top of workout screen
✅ **Seamless Integration** - Works with existing workout system
✅ **Secure** - RLS policies protect user data
✅ **Fast Queries** - Database indexes for optimal performance
✅ **Error Handling** - Graceful handling of edge cases

## 📱 User Experience Flow

### Scenario 1: Schedule a workout for tomorrow
1. Open home screen
2. See calendar showing this week
3. Tap tomorrow's date
4. Modal opens - see list of my workouts
5. Tap "Full Body Workout"
6. Success message - workout scheduled
7. Calendar updates - tomorrow now has workout icon

### Scenario 2: Start today's scheduled workout
1. Open workout screen
2. See "SCHEDULED WORKOUT" at top
3. See "Full Body Workout" with exercises listed
4. Tap "Start Scheduled Workout"
5. Workout begins immediately

### Scenario 3: Change scheduled workout
1. Open home screen
2. Tap day that already has a workout
3. Modal shows current workout details
4. Scroll down to "Or Choose Different Workout"
5. Tap different workout
6. Updates successfully

## 🔧 Technical Details

### How the Calendar Works:
- Uses `getCurrentWeekDates()` to get Monday-Sunday range
- Fetches all workouts in that range with one database query
- Converts array to object with date as key for O(1) lookup
- Renders 7 day cells, checks if each has a workout
- Uses `isSameDay()` to highlight today

### How Today's Workout Shows:
- `fetchTodayScheduledWorkout()` runs when workout screen mounts
- Gets today's date and queries database for that specific date
- If found, stores in `todayScheduledWorkout` state
- Conditional render shows workout section if state is not null
- Section appears BEFORE all other workout content

### How Scheduling Works:
- Modal shows user's existing workouts from `workouts` table
- When user selects one, it copies the workout data to `scheduled_workouts`
- Stores as JSON in `workout_exercises` field
- Creates a snapshot of the workout at scheduling time
- If original workout is edited later, scheduled version stays the same

## 🛠️ Customization Options

### Change Week Start Day:
Edit `getCurrentWeekDates()` in `scheduledWorkoutHelpers.js`
```javascript
// Current: Monday (1) as first day
// To start on Sunday (0):
const mondayOffset = dayOfWeek === 0 ? 0 : -dayOfWeek;
```

### Change Styling:
All styles are in StyleSheet.create at bottom of each component
- Calendar: `components/WeeklyWorkoutCalendar.js` (line 176+)
- Modal: `components/ScheduledWorkoutModal.js` (line 237+)
- Workout Section: `app/(tabs)/workout.js` (line 2816+)

### Add Notes Feature:
The `notes` field already exists in database
To enable:
1. Add TextInput to ScheduledWorkoutModal
2. Pass notes when calling `addScheduledWorkout()`
3. Display notes in calendar tooltip or workout section

## 🐛 Troubleshooting

### Calendar Not Showing:
- Check if SQL was executed successfully
- Verify table exists: `SELECT * FROM scheduled_workouts LIMIT 1;`
- Check RLS is enabled: Look in Supabase Dashboard → Authentication → Policies

### Can't Schedule Workouts:
- Verify user has created workouts first
- Check browser console for errors
- Ensure user is logged in (`userProfile` is not null)

### Today's Workout Not Showing:
- Verify workout is scheduled for TODAY specifically
- Check timezone - dates must match exactly
- Look in database: `SELECT * FROM scheduled_workouts WHERE user_id = 'USER_ID';`

### Duplicate Workout Error:
- This is expected - unique constraint prevents multiple workouts per day
- User must delete existing first, or modal will offer to replace

## 📊 Database Schema Summary

```sql
Table: scheduled_workouts
├── id (UUID) - Primary Key
├── user_id (UUID) - Foreign Key → auth.users(id)
├── scheduled_date (DATE) - When workout is scheduled
├── workout_name (TEXT) - Name of workout
├── workout_exercises (JSONB) - Exercise array
├── notes (TEXT) - Optional notes
├── created_at (TIMESTAMP) - When scheduled
└── updated_at (TIMESTAMP) - Last modified

Unique Constraint: (user_id, scheduled_date)
```

## ✅ Testing Checklist

- [ ] Run SQL script in Supabase
- [ ] Verify table and policies exist
- [ ] Create a workout in the app
- [ ] Schedule that workout for tomorrow
- [ ] See it appear on calendar
- [ ] Schedule a workout for today
- [ ] Open workout screen - see it at top
- [ ] Tap "Start Scheduled Workout"
- [ ] Verify workout starts correctly
- [ ] Delete a scheduled workout
- [ ] Try to schedule two workouts for same day (should show alert)
- [ ] Test on different days of week

## 🎓 Code Explanations

### Why JSONB for exercises?
- Flexible - can store any exercise structure
- Native PostgreSQL support for querying JSON
- No need for separate exercises table
- Easy to snapshot workout at scheduling time

### Why forwardRef for calendar?
- Parent component needs to call `refresh()` method
- React refs allow parent → child communication
- Triggered after adding/editing/deleting workout
- Keeps calendar in sync with database

### Why separate helpers file?
- Reusable database functions
- DRY principle - don't repeat query logic
- Easy to test in isolation
- Centralized error handling
- Date utility functions used by multiple components

## 🚀 Future Enhancements

Possible additions:
- 📅 Multi-week view (scroll through weeks)
- 🔔 Notifications for scheduled workouts
- 📝 Workout notes/instructions
- 🔄 Recurring workouts (e.g., "every Monday")
- 📈 Analytics (workout adherence tracking)
- 🎨 Color-coded workout types
- ✅ Mark as complete without starting
- 📤 Export schedule to calendar app

## 📞 Support

If you encounter issues:
1. Check console for error messages
2. Verify database setup is complete
3. Ensure RLS policies are correct
4. Check that supabase client is configured
5. Verify user authentication is working

## 🎉 Success!

You now have a fully functional weekly workout scheduler integrated into your fitness app!

