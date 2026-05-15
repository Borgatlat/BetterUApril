# BetterU League Feature Documentation

## 📋 Table of Contents
1. [Feature Overview](#feature-overview)
2. [Core Concepts](#core-concepts)
3. [Database Structure](#database-structure)
4. [Trophy System](#trophy-system)
5. [League Tiers](#league-tiers)
6. [Monthly Challenges](#monthly-challenges)
7. [UI/UX Design](#uiux-design)
8. [Navigation Structure](#navigation-structure)
9. [Implementation Details](#implementation-details)
10. [User Flows](#user-flows)

---

## 🎯 Feature Overview

**BetterU League** is a competitive team-based challenge system where teams of up to 20 members compete in monthly challenges to earn trophies and climb league tiers. It's a separate system from regular groups, focused purely on competition and achievement.

### Key Features
- **Teams**: Max 20 members, one team per user
- **Monthly Challenges**: Rotating challenge types (workout minutes, total workouts, streaks, etc.)
- **Trophy System**: Earn trophies based on global rankings
- **League Tiers**: Bronze → Silver → Gold → Platinum → Diamond → Master
- **Trophy Multipliers**: Higher leagues earn bonus trophies
- **Global Competition**: All teams compete together in one leaderboard

---

## 🏗️ Core Concepts

### Teams vs Groups
- **Groups**: Social features (feed, posts, discussions), unlimited members, multiple groups allowed
- **Teams**: Competitive challenges only, max 20 members, one team per user

### Competition Structure
- All teams compete in the **same global challenge** each month
- League tier is a **status indicator** based on total accumulated trophies
- League tier provides **trophy multipliers** (1.0x to 1.5x bonus)
- One global leaderboard for all teams

### Challenge Cycle
1. New challenge starts on the 1st of each month
2. Challenge type rotates (workout minutes, total workouts, streaks, etc.)
3. All teams compete globally
4. Challenge ends on the last day of the month
5. Trophies awarded based on final rankings
6. New challenge starts next month

---

## 🗄️ Database Structure

### Teams Table
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    avatar_url TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    max_members INTEGER DEFAULT 20,
    
    -- League system fields
    total_trophies INTEGER DEFAULT 0,
    current_league VARCHAR(20) DEFAULT 'Bronze',
    best_league VARCHAR(20) DEFAULT 'Bronze', -- Highest league ever reached
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Team Members Table
```sql
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id), -- Enforces one team per user
    UNIQUE(team_id, user_id)
);
```

### League Challenges Table
```sql
CREATE TABLE league_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Challenge details
    challenge_type VARCHAR(50) NOT NULL, 
    -- Types: 'workout_minutes', 'total_workouts', 'streak', 'runs', 
    --       'mental_sessions', 'prs', 'calories', 'distance'
    name VARCHAR(100) NOT NULL, -- "January Workout Minutes Challenge"
    description TEXT,
    
    -- Time period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'upcoming' 
        CHECK (status IN ('upcoming', 'active', 'completed')),
    
    -- Prize info
    prize_description TEXT, 
    -- "Top 3 teams get 1 month Premium free per member"
    prize_type VARCHAR(50), 
    -- 'premium_subscription', 'badge', 'cash', 'merchandise'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Team Challenge Participants Table
```sql
CREATE TABLE team_challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES league_challenges(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Current progress (cached for performance)
    current_value INTEGER DEFAULT 0, -- e.g., 15,000 minutes
    rank INTEGER, -- Global rank (1st, 2nd, 3rd, etc.)
    
    -- Results (after challenge ends)
    final_value INTEGER,
    final_rank INTEGER,
    base_trophies INTEGER DEFAULT 0, -- Trophies before multiplier
    trophies_earned INTEGER DEFAULT 0, -- Final trophies after multiplier
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(challenge_id, team_id)
);
```

### Trophy History Table
```sql
CREATE TABLE team_trophy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES league_challenges(id) ON DELETE CASCADE,
    base_trophies INTEGER NOT NULL,
    multiplier DECIMAL(3,2) NOT NULL, -- e.g., 1.5 for Master league
    trophies_earned INTEGER NOT NULL,
    rank_achieved INTEGER,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_teams_total_trophies ON teams(total_trophies DESC);
CREATE INDEX idx_challenge_participants_challenge_rank ON team_challenge_participants(challenge_id, rank);
CREATE INDEX idx_league_challenges_status ON league_challenges(status, start_date);
```

### Row Level Security (RLS)
```sql
-- Teams: Viewable by everyone, editable by owners/admins
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone" ON teams
    FOR SELECT USING (true);

CREATE POLICY "Team owners can update their team" ON teams
    FOR UPDATE USING (auth.uid() = created_by);

-- Team members: Viewable by everyone, joinable by users
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members are viewable by everyone" ON team_members
    FOR SELECT USING (true);

CREATE POLICY "Users can join teams" ON team_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Challenge participants: Viewable by everyone
ALTER TABLE team_challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge participants are viewable by everyone" 
    ON team_challenge_participants FOR SELECT USING (true);
```

---

## 🏆 Trophy System

### Base Trophy Distribution
Based on global ranking at end of challenge:

```
1st Place:   100 base trophies 🥇
2nd Place:    25 base trophies 🥈
3rd Place:    10 base trophies 🥉
4th-10th:      5 base trophies
11th-25th:     1 base trophy
26th+:          0 trophies
```

### League Multiplier System
Trophy multipliers based on team's current league tier:

```
Bronze League:   1.0x (no bonus)
Silver League:   1.1x (10% bonus)
Gold League:     1.2x (20% bonus)
Platinum League: 1.3x (30% bonus)
Diamond League:  1.4x (40% bonus)
Master League:   1.5x (50% bonus)
```

### Trophy Calculation Example
- **Team A** (Gold League, 1.2x multiplier) ranks #5
  - Base trophies: 5
  - Multiplier: 1.2x
  - Final trophies: 5 × 1.2 = **6 trophies**

- **Team B** (Master League, 1.5x multiplier) ranks #5
  - Base trophies: 5
  - Multiplier: 1.5x
  - Final trophies: 5 × 1.5 = **7.5 → 8 trophies** (rounded)

### Trophy Accumulation
- Trophies accumulate over time (never decrease)
- Total trophies determine league tier
- Trophy history is tracked for transparency

---

## 📊 League Tiers

### Tier Thresholds
```
Bronze League:     0-99 trophies
Silver League:   100-499 trophies
Gold League:    500-1,499 trophies
Platinum League: 1,500-4,999 trophies
Diamond League:   5,000-9,999 trophies
Master League:   10,000+ trophies
```

### League Progression
- Teams automatically move up/down leagues based on total trophies
- `best_league` tracks the highest league ever reached (never decreases)
- League tier affects trophy multipliers for future challenges

### Visual Indicators
- League badge/icon displayed on team profile
- Color coding: Bronze (brown), Silver (gray), Gold (yellow), Platinum (platinum), Diamond (blue), Master (purple)
- League name shown prominently in team cards

---

## 🎯 Monthly Challenges

### Challenge Types (Rotating)
1. **Workout Minutes** - Total minutes from workouts (10+ min minimum)
2. **Total Workouts** - Count of completed workouts (10+ min minimum)
3. **Longest Streak** - Highest consecutive day streak achieved
4. **Mental Sessions** - Count of mental wellness sessions
5. **Runs Completed** - Count of GPS-tracked runs
6. **PRs Achieved** - Count of personal records set
7. **Calories Tracked** - Total calories logged
8. **Distance Run** - Total distance from runs

### Challenge Schedule Example
```
January:   Workout Minutes
February:  Total Workouts
March:     Longest Streak
April:     Mental Sessions
May:       Runs Completed
June:      PRs Achieved
July:      Workout Minutes (repeat)
August:    Total Workouts (repeat)
... (rotates through types)
```

### Challenge Rules
- **10-minute minimum** for workouts (prevents cheating)
- Only activities completed during challenge period count
- Real-time progress updates via database triggers
- Final rankings calculated at end of month

### Prize System
- **Top 3 teams**: 1 month Premium free per member
- **Top 10 teams**: 2 weeks Premium free
- **Top 25 teams**: Premium badge/avatar frame
- **All participants**: Participation badge
- Prizes can be customized per challenge

---

## 🎨 UI/UX Design

### Design Principles
- **Clean & Modern**: Minimalist design with clear hierarchy
- **Competitive Feel**: Bold colors, trophy icons, ranking emphasis
- **Easy Navigation**: Intuitive flow, clear CTAs
- **Visual Feedback**: Progress bars, animations, celebrations
- **Mobile-First**: Optimized for mobile screens

### Color Scheme
- **Primary**: Cyan (#00ffff) - matches app theme
- **Gold**: #FFD700 - for trophies and winners
- **Silver**: #C0C0C0 - for 2nd place
- **Bronze**: #CD7F32 - for 3rd place
- **Background**: Black (#000000) - matches app theme
- **Cards**: Dark gray (#1a1a1a) with subtle borders

### Typography
- **Headers**: Bold, large (24-32px)
- **Body**: Regular, readable (16-18px)
- **Stats**: Bold, prominent (20-24px)
- **Labels**: Medium weight, smaller (14px)

---

## 📱 Navigation Structure

### Tab Bar Placement
```
[Home] [Workout] [Community] [League] [Profile]
                              ↑
                    New League Tab
```

### League Tab Structure

#### Main Screen: "BetterU League"
```
┌─────────────────────────────────────────┐
│  BetterU League              [Settings] │
├─────────────────────────────────────────┤
│  My Team Section                        │
│  ┌───────────────────────────────────┐ │
│  │ Team: "Gym Warriors"              │ │
│  │ League: Gold 🏆                   │ │
│  │ Trophies: 1,250                   │ │
│  │ Members: 15/20                    │ │
│  └───────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  Current Challenge                     │
│  ┌───────────────────────────────────┐ │
│  │ "January Workout Minutes"        │ │
│  │ Days Remaining: 12                │ │
│  │ Your Team Rank: #15               │ │
│  │ Team Progress: 8,500/10,000 min   │ │
│  │ [Progress Bar]                    │ │
│  │ Prize: Top 3 get Premium free!    │ │
│  └───────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  [View Full Leaderboard] →             │
├─────────────────────────────────────────┤
│  Quick Stats                           │
│  • Your Rank: #15                      │
│  • Team Total: 8,500 min               │
│  • Avg per Member: 567 min             │
└─────────────────────────────────────────┘
```

#### Sub-Screens Navigation
```
League Tab
├── Main Screen (default)
│   ├── My Team Card
│   ├── Current Challenge Card
│   └── Quick Stats
│
├── Leaderboard Screen
│   ├── Global Rankings (Top 100)
│   ├── Your Team Highlighted
│   ├── Filter by League Tier
│   └── Search Teams
│
├── Team Detail Screen
│   ├── Team Info (name, description, members)
│   ├── Trophy History (last 6 months)
│   ├── Challenge History
│   ├── Member List
│   └── Team Settings (if owner/admin)
│
├── Create/Join Team Screen
│   ├── Create New Team
│   ├── Browse Teams
│   ├── Search Teams
│   └── Join Requests
│
└── Challenge History Screen
    ├── Past Challenges
    ├── Results & Rankings
    └── Trophy Awards
```

---

## 🖼️ Detailed UI Components

### 1. Main League Screen

#### Header Section
```jsx
<View style={styles.header}>
  <Text style={styles.title}>BetterU League</Text>
  <TouchableOpacity onPress={openSettings}>
    <Ionicons name="settings-outline" size={24} color="#00ffff" />
  </TouchableOpacity>
</View>
```

#### My Team Card
```jsx
<View style={styles.teamCard}>
  <View style={styles.teamHeader}>
    <Image source={teamAvatar} style={styles.teamAvatar} />
    <View style={styles.teamInfo}>
      <Text style={styles.teamName}>{team.name}</Text>
      <View style={styles.leagueBadge}>
        <Text style={styles.leagueText}>{team.current_league} 🏆</Text>
      </View>
    </View>
  </View>
  
  <View style={styles.teamStats}>
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{team.total_trophies}</Text>
      <Text style={styles.statLabel}>Total Trophies</Text>
    </View>
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{team.member_count}/20</Text>
      <Text style={styles.statLabel}>Members</Text>
    </View>
  </View>
  
  <TouchableOpacity 
    style={styles.viewTeamButton}
    onPress={navigateToTeamDetail}
  >
    <Text style={styles.viewTeamText}>View Team →</Text>
  </TouchableOpacity>
</View>
```

#### Current Challenge Card
```jsx
<View style={styles.challengeCard}>
  <View style={styles.challengeHeader}>
    <Text style={styles.challengeName}>{challenge.name}</Text>
    <View style={styles.daysRemaining}>
      <Ionicons name="time-outline" size={16} color="#00ffff" />
      <Text style={styles.daysText}>{daysRemaining} days left</Text>
    </View>
  </View>
  
  <View style={styles.rankSection}>
    <Text style={styles.rankLabel}>Your Team Rank</Text>
    <Text style={styles.rankValue}>#{teamRank}</Text>
  </View>
  
  <View style={styles.progressSection}>
    <View style={styles.progressHeader}>
      <Text style={styles.progressLabel}>Team Progress</Text>
      <Text style={styles.progressValue}>
        {currentValue.toLocaleString()} / {goalValue.toLocaleString()}
      </Text>
    </View>
    <ProgressBar 
      progress={progressPercentage} 
      color="#00ffff"
      height={8}
    />
  </View>
  
  {challenge.prize_description && (
    <View style={styles.prizeSection}>
      <Ionicons name="trophy-outline" size={16} color="#FFD700" />
      <Text style={styles.prizeText}>{challenge.prize_description}</Text>
    </View>
  )}
  
  <TouchableOpacity 
    style={styles.viewLeaderboardButton}
    onPress={navigateToLeaderboard}
  >
    <Text style={styles.viewLeaderboardText}>View Full Leaderboard →</Text>
  </TouchableOpacity>
</View>
```

### 2. Leaderboard Screen

#### Top 3 Podium
```jsx
<View style={styles.podiumContainer}>
  {/* 2nd Place */}
  <View style={[styles.podiumItem, styles.secondPlace]}>
    <View style={styles.podiumRank}>2</View>
    <Image source={team2.avatar} style={styles.podiumAvatar} />
    <Text style={styles.podiumName}>{team2.name}</Text>
    <Text style={styles.podiumValue}>{team2.value.toLocaleString()}</Text>
    <View style={styles.silverBadge}>🥈</View>
  </View>
  
  {/* 1st Place (taller) */}
  <View style={[styles.podiumItem, styles.firstPlace]}>
    <View style={styles.podiumRank}>1</View>
    <Image source={team1.avatar} style={styles.podiumAvatar} />
    <Text style={styles.podiumName}>{team1.name}</Text>
    <Text style={styles.podiumValue}>{team1.value.toLocaleString()}</Text>
    <View style={styles.goldBadge}>🥇</View>
  </View>
  
  {/* 3rd Place */}
  <View style={[styles.podiumItem, styles.thirdPlace]}>
    <View style={styles.podiumRank}>3</View>
    <Image source={team3.avatar} style={styles.podiumAvatar} />
    <Text style={styles.podiumName}>{team3.name}</Text>
    <Text style={styles.podiumValue}>{team3.value.toLocaleString()}</Text>
    <View style={styles.bronzeBadge}>🥉</View>
  </View>
</View>
```

#### Leaderboard List
```jsx
<FlatList
  data={leaderboard}
  renderItem={({ item, index }) => (
    <View style={[
      styles.leaderboardItem,
      item.isMyTeam && styles.myTeamHighlight
    ]}>
      <Text style={styles.rank}>{item.rank}</Text>
      <Image source={item.avatar} style={styles.teamAvatarSmall} />
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name}</Text>
        <Text style={styles.leagueTier}>{item.league}</Text>
      </View>
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{item.value.toLocaleString()}</Text>
        {item.rank <= 25 && (
          <Text style={styles.trophyPreview}>
            +{item.estimatedTrophies} 🏆
          </Text>
        )}
      </View>
    </View>
  )}
  keyExtractor={(item) => item.team_id}
/>
```

### 3. Team Detail Screen

#### Team Header
```jsx
<View style={styles.teamDetailHeader}>
  <Image source={team.avatar_url} style={styles.teamDetailAvatar} />
  <Text style={styles.teamDetailName}>{team.name}</Text>
  <Text style={styles.teamDetailDescription}>{team.description}</Text>
  
  <View style={styles.teamDetailStats}>
    <View style={styles.detailStat}>
      <Text style={styles.detailStatValue}>{team.total_trophies}</Text>
      <Text style={styles.detailStatLabel}>Trophies</Text>
    </View>
    <View style={styles.detailStat}>
      <Text style={styles.detailStatValue}>{team.current_league}</Text>
      <Text style={styles.detailStatLabel}>League</Text>
    </View>
    <View style={styles.detailStat}>
      <Text style={styles.detailStatValue}>{team.member_count}/20</Text>
      <Text style={styles.detailStatLabel}>Members</Text>
    </View>
  </View>
</View>
```

#### Trophy History Chart
```jsx
<View style={styles.trophyHistorySection}>
  <Text style={styles.sectionTitle}>Trophy History</Text>
  <View style={styles.trophyChart}>
    {trophyHistory.map((entry, index) => (
      <View key={index} style={styles.trophyBar}>
        <View 
          style={[
            styles.trophyBarFill, 
            { height: `${(entry.trophies / maxTrophies) * 100}%` }
          ]} 
        />
        <Text style={styles.trophyMonth}>{entry.month}</Text>
        <Text style={styles.trophyValue}>{entry.trophies}</Text>
      </View>
    ))}
  </View>
</View>
```

### 4. Create/Join Team Screen

#### Create Team Form
```jsx
<View style={styles.createTeamContainer}>
  <Text style={styles.createTeamTitle}>Create Your Team</Text>
  
  <TextInput
    style={styles.teamNameInput}
    placeholder="Team Name (max 50 characters)"
    value={teamName}
    onChangeText={setTeamName}
    maxLength={50}
  />
  
  <TextInput
    style={styles.teamDescriptionInput}
    placeholder="Team Description (optional)"
    value={teamDescription}
    onChangeText={setTeamDescription}
    multiline
    numberOfLines={3}
  />
  
  <TouchableOpacity 
    style={styles.uploadAvatarButton}
    onPress={pickAvatar}
  >
    <Ionicons name="camera-outline" size={24} color="#00ffff" />
    <Text style={styles.uploadAvatarText}>Upload Team Avatar</Text>
  </TouchableOpacity>
  
  <TouchableOpacity 
    style={[styles.createButton, !teamName && styles.createButtonDisabled]}
    onPress={createTeam}
    disabled={!teamName}
  >
    <Text style={styles.createButtonText}>Create Team</Text>
  </TouchableOpacity>
</View>
```

#### Browse Teams
```jsx
<View style={styles.browseTeamsContainer}>
  <TextInput
    style={styles.searchInput}
    placeholder="Search teams..."
    value={searchQuery}
    onChangeText={setSearchQuery}
  />
  
  <View style={styles.filterButtons}>
    <TouchableOpacity 
      style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
      onPress={() => setSelectedFilter('all')}
    >
      <Text style={styles.filterButtonText}>All</Text>
    </TouchableOpacity>
    {['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'].map(league => (
      <TouchableOpacity
        key={league}
        style={[styles.filterButton, selectedFilter === league && styles.filterButtonActive]}
        onPress={() => setSelectedFilter(league)}
      >
        <Text style={styles.filterButtonText}>{league}</Text>
      </TouchableOpacity>
    ))}
  </View>
  
  <FlatList
    data={filteredTeams}
    renderItem={({ item }) => (
      <TouchableOpacity 
        style={styles.teamCard}
        onPress={() => viewTeam(item)}
      >
        <Image source={item.avatar_url} style={styles.teamCardAvatar} />
        <View style={styles.teamCardInfo}>
          <Text style={styles.teamCardName}>{item.name}</Text>
          <Text style={styles.teamCardLeague}>{item.current_league}</Text>
          <Text style={styles.teamCardMembers}>{item.member_count}/20 members</Text>
        </View>
        <TouchableOpacity 
          style={styles.joinButton}
          onPress={() => joinTeam(item.id)}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )}
    keyExtractor={(item) => item.id}
  />
</View>
```

---

## 🔄 User Flows

### Flow 1: New User Joining League
```
1. User opens League tab for first time
2. Sees "Join BetterU League" screen
3. Options:
   a. Create new team
   b. Browse existing teams
   c. Search for specific team
4. User creates/joins team
5. Automatically enrolled in current month's challenge
6. Redirected to main League screen
```

### Flow 2: Viewing Current Challenge
```
1. User opens League tab
2. Sees main screen with:
   - My Team card
   - Current Challenge card
   - Quick stats
3. Taps "View Full Leaderboard"
4. Sees global rankings with:
   - Top 3 podium
   - Full list (top 100)
   - Their team highlighted
5. Can filter by league tier
6. Can search for specific teams
```

### Flow 3: Team Management
```
1. User taps "View Team" from main screen
2. Sees Team Detail screen:
   - Team info
   - Trophy history
   - Challenge history
   - Member list
3. If owner/admin:
   - Can edit team details
   - Can manage members (promote, remove)
   - Can change team settings
4. If member:
   - Can view team info
   - Can leave team
```

### Flow 4: Challenge Completion
```
1. Challenge ends on last day of month
2. System calculates final rankings
3. Awards trophies based on:
   - Final rank (base trophies)
   - League tier (multiplier)
4. Updates team total_trophies
5. Recalculates league tiers
6. Sends push notifications to all participants
7. Shows celebration screen with results
8. New challenge starts next day
```

---

## ⚙️ Implementation Details

### Auto-Creating Monthly Challenges
```sql
-- Function to create monthly challenge
CREATE OR REPLACE FUNCTION create_monthly_challenge()
RETURNS VOID AS $$
DECLARE
    v_challenge_type VARCHAR(50);
    v_month_name VARCHAR(20);
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Get current month info
    v_start_date := DATE_TRUNC('month', CURRENT_DATE);
    v_end_date := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    v_month_name := TO_CHAR(CURRENT_DATE, 'Month YYYY');
    
    -- Rotate challenge types (example logic)
    v_challenge_type := CASE 
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 1 THEN 'workout_minutes'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 2 THEN 'total_workouts'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 3 THEN 'streak'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 4 THEN 'mental_sessions'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 5 THEN 'runs'
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) % 7 = 6 THEN 'prs'
        ELSE 'workout_minutes'
    END;
    
    -- Create challenge
    INSERT INTO league_challenges (
        challenge_type,
        name,
        description,
        start_date,
        end_date,
        status,
        prize_description
    ) VALUES (
        v_challenge_type,
        v_month_name || ' ' || INITCAP(REPLACE(v_challenge_type, '_', ' ')) || ' Challenge',
        'Compete with teams worldwide in this month''s challenge!',
        v_start_date,
        v_end_date,
        'active',
        'Top 3 teams get 1 month Premium free per member!'
    );
END;
$$ LANGUAGE plpgsql;
```

### Challenge Progress Calculation
```sql
-- Function to calculate team progress for workout minutes challenge
CREATE OR REPLACE FUNCTION calculate_workout_minutes(
    p_team_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_total_minutes INTEGER;
BEGIN
    SELECT COALESCE(SUM(uwl.duration), 0)::INTEGER
    INTO v_total_minutes
    FROM user_workout_logs uwl
    JOIN team_members tm ON uwl.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
    AND uwl.duration >= 10  -- 10 minute minimum
    AND DATE(uwl.completed_at) BETWEEN p_start_date AND p_end_date;
    
    RETURN v_total_minutes;
END;
$$ LANGUAGE plpgsql;
```

### Trophy Award Function
```sql
CREATE OR REPLACE FUNCTION award_challenge_trophies(p_challenge_id UUID)
RETURNS VOID AS $$
DECLARE
    v_team_record RECORD;
    v_base_trophies INTEGER;
    v_multiplier DECIMAL(3,2);
    v_final_trophies INTEGER;
BEGIN
    -- Update final rankings
    UPDATE team_challenge_participants tcp
    SET final_rank = subq.rank,
        final_value = subq.current_value
    FROM (
        SELECT 
            team_id,
            current_value,
            ROW_NUMBER() OVER (ORDER BY current_value DESC, last_updated ASC) as rank
        FROM team_challenge_participants
        WHERE challenge_id = p_challenge_id
    ) subq
    WHERE tcp.team_id = subq.team_id 
    AND tcp.challenge_id = p_challenge_id;
    
    -- Award trophies
    FOR v_team_record IN 
        SELECT 
            tcp.team_id,
            tcp.final_rank,
            t.current_league,
            t.total_trophies
        FROM team_challenge_participants tcp
        JOIN teams t ON tcp.team_id = t.id
        WHERE tcp.challenge_id = p_challenge_id
        ORDER BY tcp.final_rank
    LOOP
        -- Calculate base trophies
        v_base_trophies := CASE
            WHEN v_team_record.final_rank = 1 THEN 100
            WHEN v_team_record.final_rank = 2 THEN 25
            WHEN v_team_record.final_rank = 3 THEN 10
            WHEN v_team_record.final_rank BETWEEN 4 AND 10 THEN 5
            WHEN v_team_record.final_rank BETWEEN 11 AND 25 THEN 1
            ELSE 0
        END;
        
        -- Get league multiplier
        v_multiplier := CASE v_team_record.current_league
            WHEN 'Master' THEN 1.5
            WHEN 'Diamond' THEN 1.4
            WHEN 'Platinum' THEN 1.3
            WHEN 'Gold' THEN 1.2
            WHEN 'Silver' THEN 1.1
            ELSE 1.0
        END;
        
        -- Calculate final trophies
        v_final_trophies := ROUND(v_base_trophies * v_multiplier)::INTEGER;
        
        -- Update participant record
        UPDATE team_challenge_participants
        SET base_trophies = v_base_trophies,
            trophies_earned = v_final_trophies
        WHERE challenge_id = p_challenge_id
        AND team_id = v_team_record.team_id;
        
        -- Add to trophy history
        INSERT INTO team_trophy_history (
            team_id,
            challenge_id,
            base_trophies,
            multiplier,
            trophies_earned,
            rank_achieved
        ) VALUES (
            v_team_record.team_id,
            p_challenge_id,
            v_base_trophies,
            v_multiplier,
            v_final_trophies,
            v_team_record.final_rank
        );
        
        -- Update team total trophies
        UPDATE teams
        SET total_trophies = (
            SELECT COALESCE(SUM(trophies_earned), 0)
            FROM team_trophy_history
            WHERE team_id = teams.id
        )
        WHERE id = v_team_record.team_id;
        
        -- Update league tier
        UPDATE teams
        SET current_league = CASE
            WHEN total_trophies >= 10000 THEN 'Master'
            WHEN total_trophies >= 5000 THEN 'Diamond'
            WHEN total_trophies >= 1500 THEN 'Platinum'
            WHEN total_trophies >= 500 THEN 'Gold'
            WHEN total_trophies >= 100 THEN 'Silver'
            ELSE 'Bronze'
        END,
        best_league = CASE
            WHEN current_league = 'Master' AND best_league != 'Master' THEN 'Master'
            WHEN current_league = 'Diamond' AND best_league NOT IN ('Master', 'Diamond') THEN 'Diamond'
            WHEN current_league = 'Platinum' AND best_league NOT IN ('Master', 'Diamond', 'Platinum') THEN 'Platinum'
            WHEN current_league = 'Gold' AND best_league NOT IN ('Master', 'Diamond', 'Platinum', 'Gold') THEN 'Gold'
            WHEN current_league = 'Silver' AND best_league = 'Bronze' THEN 'Silver'
            ELSE best_league
        END
        WHERE id = v_team_record.team_id;
    END LOOP;
    
    -- Mark challenge as completed
    UPDATE league_challenges
    SET status = 'completed'
    WHERE id = p_challenge_id;
END;
$$ LANGUAGE plpgsql;
```

### Real-Time Progress Updates
```sql
-- Trigger to update challenge progress when workout is completed
CREATE OR REPLACE FUNCTION update_challenge_on_workout()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id UUID;
    v_challenge_record RECORD;
BEGIN
    -- Only process if workout is 10+ minutes
    IF NEW.duration < 10 THEN
        RETURN NEW;
    END IF;
    
    -- Get user's team
    SELECT team_id INTO v_team_id
    FROM team_members
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    IF v_team_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Update all active challenges for this team
    FOR v_challenge_record IN
        SELECT id, challenge_type, start_date, end_date
        FROM league_challenges
        WHERE status = 'active'
        AND DATE(NEW.completed_at) BETWEEN start_date AND end_date
    LOOP
        -- Only update if challenge type matches
        IF v_challenge_record.challenge_type IN ('workout_minutes', 'total_workouts') THEN
            -- Recalculate progress
            PERFORM update_team_challenge_progress(
                v_challenge_record.id,
                v_team_id
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_challenge_on_workout
    AFTER INSERT ON user_workout_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_on_workout();
```

---

## 📋 Implementation Checklist

### Phase 1: Database Setup
- [ ] Create all database tables
- [ ] Set up RLS policies
- [ ] Create indexes for performance
- [ ] Create helper functions
- [ ] Set up triggers for real-time updates

### Phase 2: Backend Logic
- [ ] Implement challenge creation system
- [ ] Implement progress calculation functions
- [ ] Implement trophy award system
- [ ] Implement league tier calculation
- [ ] Set up scheduled jobs for monthly challenges

### Phase 3: Frontend - Core Screens
- [ ] League tab in navigation
- [ ] Main League screen
- [ ] Leaderboard screen
- [ ] Team detail screen
- [ ] Create/Join team screen

### Phase 4: Frontend - Features
- [ ] Real-time progress updates
- [ ] Trophy history visualization
- [ ] Challenge history
- [ ] Team management (for owners/admins)
- [ ] Notifications for challenge updates

### Phase 5: Polish
- [ ] Animations and transitions
- [ ] Celebration screens
- [ ] Error handling
- [ ] Loading states
- [ ] Empty states

### Phase 6: Testing
- [ ] Test challenge creation
- [ ] Test progress calculation
- [ ] Test trophy awards
- [ ] Test league progression
- [ ] Test edge cases

---

## 🎉 Summary

The **BetterU League** feature creates a competitive, engaging system that:
- Encourages long-term engagement through trophy accumulation
- Provides monthly excitement with rotating challenges
- Rewards consistency and performance
- Creates team camaraderie and competition
- Offers clear progression through league tiers
- Maintains fairness with global competition and league multipliers

The system is designed to be simple to understand, exciting to participate in, and rewarding for all skill levels.

