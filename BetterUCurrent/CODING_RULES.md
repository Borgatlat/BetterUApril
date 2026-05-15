# BetterU Agent Coding Rules

These rules must be followed when editing or creating code in the BetterU codebase to maintain consistency.

## StyleSheet Patterns

### Rule: Always use StyleSheet.create at the bottom of component files

**Pattern:**
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // ... more styles
});
```

### Rule: Use camelCase for all style object keys

**Pattern:**
```javascript
const styles = StyleSheet.create({
  headerContainer: { },
  userMessageText: { },
  statsContainer: { },
});
```

---

## Color Scheme

### Rule: Use the established color palette

**Primary Colors:**
- Background: `#000` (black)
- Card Background: `#18191b` or `rgba(34, 34, 34, 0.85)`
- Primary Accent: `#00ffff` (cyan)
- Secondary Accent: `#8b5cf6` (purple)
- Text Primary: `#fff` (white)
- Text Secondary: `#aaa` or `#888` (gray)
- Text Tertiary: `#666` (darker gray)
- Error/Danger: `#ff4444` (red)
- Success: `#00ff00` (green)

**Transparency Patterns:**
- Semi-transparent backgrounds: `rgba(255, 255, 255, 0.05)` to `rgba(255, 255, 255, 0.1)`
- Accent overlays: `rgba(139, 92, 246, 0.1)` to `rgba(139, 92, 246, 0.3)`
- Borders: `rgba(255, 255, 255, 0.1)`

---

## Typography

### Rule: Use consistent font sizes and weights

**Font Sizes:**
- Large Title: `24px` to `32px`, `fontWeight: 'bold'`
- Title/Header: `18px` to `20px`, `fontWeight: 'bold'`
- Body: `14px` to `16px`, `fontWeight: '500'` or `'bold'`
- Small/Secondary: `12px` to `13px`, `fontWeight: '500'` or default
- Metadata: `13px`, default weight

**Font Weights:**
- Headers: `'bold'`
- Body text: `'500'` or `'bold'`
- Secondary text: default or `'500'`

**Line Height:**
- Body text: `lineHeight: 20` for 14-16px fonts

---

## Spacing

### Rule: Use consistent spacing values

**Padding:**
- Container padding: `20px` (padding: 20 or paddingHorizontal: 20)
- Card padding: `18px`
- Button padding: `10px` to `15px` (paddingHorizontal: 15, paddingVertical: 8-10)
- Small padding: `5px` to `8px`

**Margin:**
- Card margins: `18px` (marginBottom: 18)
- Section spacing: `10px` to `15px`
- Small spacing: `2px` to `8px`
- Gap property: `15px` (gap: 15) for flex containers

---

## Border Radius

### Rule: Use consistent border radius values

**Pattern:**
- Small buttons/badges: `12px` to `15px`
- Cards: `15px` to `18px`
- Large cards/modals: `20px` to `24px`
- Circular avatars: `18px` to `22px` (half of width/height)
- Input fields: `20px` to `25px`
- Message bubbles: `20px` to `22px` with `borderTopRightRadius: 8` for user messages

---

## Shadows and Elevation

### Rule: Always include both shadow and elevation for cross-platform support

**Pattern:**
```javascript
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.12 to 0.25,
shadowRadius: 3.84 to 8,
elevation: 2 to 6,
```

**Common Shadow Patterns:**
- Subtle (cards): `shadowOpacity: 0.12`, `shadowRadius: 8`, `elevation: 2`
- Medium (buttons): `shadowOpacity: 0.25`, `shadowRadius: 3.84`, `elevation: 5`
- Strong (modals): `shadowOpacity: 0.5`, `shadowRadius: 20`, `elevation: 20`

---

## Layout Patterns

### Rule: Use consistent flex patterns

**Common Patterns:**
```javascript
// Row layout
flexDirection: 'row',
justifyContent: 'space-between', // or 'flex-start', 'center', 'flex-end'
alignItems: 'center', // or 'flex-start', 'flex-end'

// Column layout
flexDirection: 'column', // default, can be omitted
justifyContent: 'center',
alignItems: 'center',

// Full width/height
flex: 1, // takes available space
width: '100%', // explicit full width
```

---

## Component-Specific Patterns

### Rule: Header components follow consistent structure

**Pattern:**
```javascript
header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 15,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255, 255, 255, 0.1)',
},
```

### Rule: Button styles follow consistent patterns

**Pattern:**
```javascript
// Primary button
primaryButton: {
  backgroundColor: 'rgba(139, 92, 246, 0.2)',
  borderRadius: 20,
  paddingHorizontal: 15,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: 'rgba(139, 92, 246, 0.3)',
},

// Disabled button
buttonDisabled: {
  opacity: 0.3,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
},
```

### Rule: Input fields follow consistent styling

**Pattern:**
```javascript
input: {
  flex: 1,
  color: '#fff',
  fontSize: 16,
  paddingVertical: 5,
  maxHeight: 100, // for multiline
},
inputContainer: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: 25,
  paddingHorizontal: 15,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.1)',
},
```

### Rule: Avatar/circular elements

**Pattern:**
```javascript
avatar: {
  width: 44,
  height: 44,
  borderRadius: 22, // half of width/height
  backgroundColor: '#222',
  justifyContent: 'center',
  alignItems: 'center',
},
```

---

## Error Handling

### Rule: Always use try-catch blocks for async operations

**Pattern:**
```javascript
try {
  const result = await someAsyncOperation();
  if (!result.success) {
    Alert.alert('Error', result.error || 'Operation failed');
  }
} catch (error) {
  console.error('Error in operation:', error);
  Alert.alert('Error', 'Failed to complete operation');
}
```

---

## Loading States

### Rule: Always show loading indicators during async operations

**Pattern:**
```javascript
const [loading, setLoading] = useState(false);

const handleOperation = async () => {
  if (loading) return;
  setLoading(true);
  try {
    await someAsyncOperation();
  } finally {
    setLoading(false);
  }
};

// In JSX:
{loading && <ActivityIndicator />}
```

---

## Daily Message Limits

### Rule: Check message limits before processing AI requests

**Pattern:**
```javascript
await checkAndResetMessageCount();
if (hasReachedLimit()) {
  if (!isPremium) {
    return { success: false, error: 'Message limit reached' };
  }
}
```

---

## AsyncStorage Pattern

### Rule: Always handle AsyncStorage errors and provide fallbacks

**Pattern:**
```javascript
try {
  const stored = await AsyncStorage.getItem('key');
  if (stored) {
    return JSON.parse(stored);
  }
  return defaultValue;
} catch (error) {
  console.error('Error reading from AsyncStorage:', error);
  return defaultValue;
}
```

---

## Component Cleanup

### Rule: Clean up subscriptions and timers in useEffect cleanup

**Pattern:**
```javascript
useEffect(() => {
  let isMounted = true;
  let timeoutId;
  
  const initData = async () => {
    if (isMounted) {
      setData(result);
    }
  };
  
  initData();
  
  return () => {
    isMounted = false;
    clearTimeout(timeoutId);
  };
}, [dependencies]);
```

---

## User ID Handling

### Rule: Always handle both user_id and id fields

**Pattern:**
```javascript
const userId = userProfile?.user_id || userProfile?.id;
if (userId) {
  // Use userId
}
```

---

## Date Handling

### Rule: Use ISO string format for dates

**Pattern:**
```javascript
const getTodayString = () => new Date().toISOString().split('T')[0];
const timestamp = new Date().toISOString();
```

---

## Notification Creation

### Rule: Use centralized notification helper functions

**Pattern:**
```javascript
import { notificationCreators, useNotificationCreator } from '../utils/notificationUtils';

const { createTypedNotification } = useNotificationCreator();
await createTypedNotification('friendRequest', senderName);
```
