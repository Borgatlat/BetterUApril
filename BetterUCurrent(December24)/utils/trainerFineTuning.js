/**
 * AI Workout Trainer Fine-Tuning System
 * 
 * This system provides direct optimization fine-tuning for the AI workout trainer
 * using correct and incorrect example responses based on exercise science research.
 * 
 * Training data is based on peer-reviewed research from:
 * - Journal of Strength and Conditioning Research
 * - Sports Medicine
 * - Medicine & Science in Sports & Exercise
 * - NSCA (National Strength and Conditioning Association) guidelines
 * - ACSM (American College of Sports Medicine) recommendations
 */

// Fine-tuning training data with correct and incorrect examples based on exercise science
export const TRAINER_TRAINING_DATA = {
  // Workout Planning & Program Design (Based on NSCA & ACSM guidelines)
  workoutPlanning: [
    {
      prompt: "I want to build muscle but I'm a beginner. What should I do?",
      correctResponse: "For beginners, research shows 3 full-body workouts per week is optimal for muscle growth. Focus on compound movements: squats, bench press, rows, overhead press, and deadlifts. Start with 3 sets of 8-12 reps per exercise, using 60-70% of your 1-rep max. Rest 2-3 minutes between sets. This frequency allows adequate recovery while maximizing protein synthesis. Track your progress and increase weight by 2.5-5% when you can complete all reps with good form.",
      incorrectResponse: "Just lift heavy weights every day. Do 5 sets of 5 reps on everything. More is always better. Train every muscle group daily.",
      reasoning: "Correct response follows NSCA guidelines: 3x/week frequency for beginners, 8-12 rep range for hypertrophy (Schoenfeld et al., 2016), compound movements, and progressive overload. Incorrect response promotes overtraining, ignores recovery needs, and uses strength-focused rep ranges (5x5) instead of hypertrophy ranges."
    },
    {
      prompt: "How many times per week should I train each muscle group?",
      correctResponse: "Research indicates training each muscle group 2-3 times per week is optimal for most people. This frequency maximizes muscle protein synthesis, which peaks 24-48 hours post-workout. For beginners, 2x/week per muscle group is sufficient. Intermediate/advanced lifters can benefit from 3x/week. Split routines (push/pull/legs) or upper/lower splits work well. Ensure 48 hours rest between training the same muscle group to allow recovery and adaptation.",
      incorrectResponse: "Train each muscle once per week. That's the only way to build real muscle. More frequent training will overtrain you.",
      reasoning: "Correct response is based on meta-analyses showing 2-3x/week frequency is superior to 1x/week for hypertrophy (Schoenfeld et al., 2016). Incorrect response promotes outdated 'bro-split' methodology that research has shown is less effective."
    },
    {
      prompt: "I want to lose weight and build muscle at the same time. Is that possible?",
      correctResponse: "Yes, body recomposition is possible, especially for beginners or those returning to training after a break. Research shows it's most effective when: 1) You're in a slight caloric deficit (200-500 calories), 2) You consume adequate protein (1.6-2.2g per kg bodyweight daily), 3) You follow a progressive resistance training program, and 4) You get sufficient sleep (7-9 hours). The process is slower than bulking/cutting cycles, but sustainable. Track both bodyweight and body composition changes, as scale weight may not reflect muscle gain.",
      incorrectResponse: "No, you can't build muscle and lose fat at the same time. You need to bulk first, then cut. That's the only way.",
      reasoning: "Correct response reflects current research on body recomposition (Garthe et al., 2011; Barakat et al., 2020), which shows it's possible with proper nutrition and training. Incorrect response promotes outdated thinking that ignores research on recomposition in beginners and those with higher body fat percentages."
    },
    {
      prompt: "What's the best rep range for building muscle?",
      correctResponse: "Research shows muscle growth occurs across a wide rep range (5-30 reps) when training to near failure. However, 6-12 reps is considered the 'hypertrophy range' because it balances mechanical tension and metabolic stress. For compound movements, 6-10 reps with heavier weight is effective. For isolation exercises, 10-15 reps works well. The key is training within 1-3 reps of failure, regardless of rep range. Vary rep ranges periodically (periodization) to maximize adaptation. Volume (total sets x reps) is more important than specific rep range.",
      incorrectResponse: "Only 8-12 reps builds muscle. Anything else is wrong. Lower reps build strength, higher reps build endurance. Stick to exactly 10 reps.",
      reasoning: "Correct response reflects Schoenfeld's 2017 meta-analysis showing hypertrophy occurs across wide rep ranges when volume is equated. Incorrect response is overly rigid and ignores research showing 5-30 rep ranges can build muscle."
    }
  ],

  programDesign: [
{prompt: "I want to build muscle but I'm a beginner. What should I do?",
correctResponse: `1. The Training (The Stimulus)
Your goal is to signal your body that it needs to grow stronger to survive the stress you are putting on it.

Stick to "Compound" Movements: These are exercises that use multiple joints and muscle groups at once. They give you the most "bang for your buck."

Examples: Squats, Deadlifts, Bench Press, Overhead Press, Rows, and Pull-ups/Lat Pulldowns.

Training Frequency: You do not need to train every day. 3 days a week (e.g., Mon/Wed/Fri) is perfect for a beginner. This allows for rest days where the actual growth happens.

The Golden Rule: Progressive Overload: You cannot lift the same weight forever and expect to grow. You must do a little bit more over time.

If you lifted 10kg for 10 reps last week, try 10kg for 11 reps this week, or 12kg for 10 reps.

Sample Beginner Full-Body Routine (3 Days/Week)
Perform 3 sets of 8–12 reps for each exercise. Rest 2 minutes between sets.

Legs: Goblet Squats (holding one dumbbell at chest) or Barbell Squats

Push (Chest/Shoulders): Dumbbell Bench Press or Push-ups

Pull (Back): Dumbbell Rows or Lat Pulldowns

Shoulders: Overhead Dumbbell Press

Core: Plank (3 sets, hold as long as you can)

2. The Nutrition (The Fuel)
You can lift weights all day, but if you don't provide the bricks, your body can't build the house.

Eat Protein: Protein is the building block of muscle.

Target: Aim for roughly 0.7 to 1 gram of protein per pound of your body weight (or 1.6g to 2.2g per kg).

Sources: Chicken, beef, fish, eggs, greek yogurt, tofu, beans, or protein powder.

Caloric Surplus: To build mass, you generally need to eat slightly more calories than you burn. You don't need to "stuff" yourself; just add a small extra meal or snack each day (about 250–500 extra calories).

Carbs are Energy: Don't fear carbohydrates (rice, potatoes, oats, pasta). You need them to fuel your hard workouts.

3. The Recovery (The Growth)
Crucial Concept: Muscles are broken down in the gym. They grow while you sleep.
+1

Sleep: Aim for 7–9 hours per night. If you cut sleep, you cut your muscle growth in half.

Rest Days: Do not train the same muscle group two days in a row. Your muscles need about 48 hours to repair themselves.

4. Common Beginner Mistakes to Avoid
Ego Lifting: Trying to lift too heavy too soon. This leads to bad form and injury. Leave your ego at the door; no one cares how much you lift.

Inconsistency: Working out hard for one week and then skipping two weeks will result in zero progress. It is better to have "okay" workouts consistently than "perfect" workouts rarely.

Ignoring Form: Watch YouTube tutorials (channels like Jeff Nippard or Squat University are great) to learn how to perform moves safely.

Summary Checklist for This Week:
Commit to going to the gym (or working out at home) 3 days this week.

Buy some easy protein sources (eggs, yogurt, protein powder).

Track your lifts (write down what weight you used so you can try to beat it next time).

Disclaimer: I am an AI, not a doctor or fitness coach. Always consult with a physician before starting a new exercise program, especially if you have pre-existing health conditions.

Would you like me to calculate your estimated daily protein target if you tell me your body weight?"`,
incorrectResponse: "You need at least 300g of protein per day to build muscle. More is always better. Only eat protein, carbs and fats will make you fat. Use the same weigght as you progress.",
reasoning: "Correct response provides a structured, evidence-based program design for beginners, including training frequency, exercise selection, nutrition, and recovery while asking users questions. Incorrect response promotes common beginner mistakes and harmful advice."
},
    {
      prompt: "I want to build strength but I'm plateauing. What should I do?",
      correctResponse: `Plateaus are a normal, even necessary, part of the training process. They usually signal that your body has fully adapted to your current routine and is waiting for a new type of stress to force further growth. Since you've already mastered the basics, here is how to break through a strength plateau:

1. The Deload Week
Counterintuitively, the best way to move forward is often to take a step back. If you've been pushing hard for 6–12 weeks, your central nervous system (CNS) and joints may be fatigued even if your muscles feel fine.

What to do: For one week, go to the gym but reduce your weights and volume by 50%.
The Goal: This allows hidden fatigue to dissipate, often leading to a sudden surge in strength the following week.

2. Change the Variables
Your body is an efficiency machine; if you do the same 3 sets of 10 every week, it stops working hard.

Vary Rep Ranges: If you usually lift in the 8–12 rep range, try a Strength Phase for 3 weeks where you do 3–5 reps with heavier weight.

Micro-Loading: Beginners can add 5lbs (2.5kg) every week. Intermediates can't. If you can't add 5lbs, buy fractional plates (0.5lb or 1lb) to add tiny amounts of weight. Progress is progress.

Change the Exercise Order: Do your plateaued lift first in your workout when you have the most energy.

3. Attack the Sticking Point
Every lift has a weak link. If you fail a bench press halfway up, your triceps might be the bottleneck.

Accessory Work: If your Squat is stuck, add Bulgarian Split Squats to build individual leg strength.

Pause Reps: If you're weak at the bottom of a lift, pause for 2 seconds at the lowest point (e.g., the bottom of a squat) to eliminate momentum and build stop-and-go power.

4. Check the Big Three Foundations
If these aren't in check, no amount of clever programming will help:

Caloric Intake: Are you eating enough? As you get stronger, your maintenance calories increase. You may simply need an extra 200–300 calories to fuel the next level of strength.

Sleep: Growth hormone is primarily released during deep sleep. If you're getting 6 hours or less, you are leaving strength on the table.

Protein: Ensure you are still hitting roughly 0.8g–1g of protein per pound of body weight.

Summary Strategy:
- Week 1: Deload - Cut all weights/sets in half. Focus on perfect form.
- Week 2: Test - Go back to your old weights. They should feel significantly lighter.
- Week 3+: Switch - Change your rep scheme (e.g., from 3x10 to 5x5) for the next month.

Would you like me to suggest some specific accessory exercises if you tell me which specific lift (Squat, Bench, etc.) is stuck?`,
      incorrectResponse: "Just lift heavier weights every day. Push through the plateau by training harder. If you're not getting stronger, you're not training hard enough. More volume and more intensity is always the answer. Don't take rest days - they're for weak people. Just keep pushing and your body will adapt.",
      reasoning: "Correct response provides evidence-based strategies for breaking plateaus including deloading (allows CNS recovery), periodization (varying rep ranges), addressing weak points, and checking foundational factors (nutrition, sleep, protein). Research shows deloading and strategic program changes are more effective than simply increasing volume. Incorrect response promotes overtraining, ignores recovery needs, and suggests more is always better, which research shows can worsen plateaus and increase injury risk."
    }
    
  ],

  // Exercise Form & Safety (Based on biomechanics research)
  exerciseForm: [
    {
      prompt: "My lower back hurts when I squat. What am I doing wrong?",
      correctResponse: "Lower back pain during squats often indicates form issues or mobility limitations. Common causes: 1) Butt wink (pelvis tucking under at depth) - limit depth or improve ankle/hip mobility, 2) Forward lean with rounded back - strengthen core, keep chest up, brace your abs, 3) Knees caving inward - strengthen glutes and focus on pushing knees out, 4) Going too deep without proper mobility - squat to parallel or slightly below, not ass-to-grass. Reduce weight, focus on form, and consider box squats to learn proper depth. If pain persists, consult a physical therapist.",
      incorrectResponse: "Just push through the pain. Pain is weakness leaving the body. Keep squatting heavy and your back will get stronger. Everyone's back hurts when squatting.",
      reasoning: "Correct response addresses biomechanical causes of back pain (Butler et al., 2010), provides specific form corrections, and emphasizes safety. Incorrect response promotes dangerous 'no pain, no gain' mentality that can lead to serious injury."
    },
    {
      prompt: "Is it bad if my knees go past my toes when squatting?",
      correctResponse: "No, knees going past toes during squats is biomechanically normal and safe when done with proper form. Research shows knee-forward squatting actually reduces hip and lower back stress while increasing quadriceps activation. The 'knees behind toes' cue is outdated and can cause excessive forward lean, increasing spinal loading. Focus on: keeping your torso upright, knees tracking over toes (not caving in), weight distributed mid-foot, and controlled descent. Knee position should be natural based on your anatomy and mobility.",
      incorrectResponse: "Never let your knees go past your toes. That's dangerous and will destroy your knees. Always keep your shins vertical and sit back more.",
      reasoning: "Correct response reflects biomechanics research (Fry et al., 2003; List et al., 2013) showing knee-forward squatting is safe and natural. Incorrect response promotes outdated, disproven myth that increases injury risk through poor mechanics."
    },
    {
      prompt: "How do I know if I'm using proper form on bench press?",
      correctResponse: "Proper bench press form includes: 1) Feet flat on floor, creating leg drive, 2) Shoulder blades retracted and depressed (pinned to bench), creating a stable base, 3) Slight arch in lower back (natural, not excessive), 4) Grip width where forearms are vertical at bottom (typically 1.5x shoulder width), 5) Bar path: lower to lower chest/nipple line, press up and slightly back toward face, 6) Control the descent (2-3 seconds), pause briefly at chest, then press explosively, 7) Keep wrists straight, not bent. Start with lighter weight to practice. Film yourself from the side to check bar path and form.",
      incorrectResponse: "Just lift the weight. Form doesn't matter as long as you get the weight up. Arch your back as much as possible and bounce the bar off your chest for more power.",
      reasoning: "Correct response provides biomechanically sound technique based on powerlifting and strength training research (Green & Comfort, 2007). Incorrect response promotes dangerous practices (bouncing, excessive arching) that increase injury risk."
    },
    {
      prompt: "I feel pain in my shoulder when doing overhead press. Should I stop?",
      correctResponse: "Yes, stop immediately if you feel pain. Shoulder pain during overhead press often indicates: 1) Impingement from poor scapular positioning - ensure shoulder blades are retracted and depressed, 2) Lack of thoracic spine mobility - improve T-spine extension, 3) Weak rotator cuff - strengthen external rotators, 4) Poor core stability - strengthen core to prevent excessive arching. Try these modifications: reduce weight, use neutral grip (palms facing), limit range of motion initially, or switch to landmine press. If pain persists after form corrections, consult a physical therapist or sports medicine doctor.",
      incorrectResponse: "Keep pushing through it. Shoulder pain is normal when building muscle. Just do more overhead press and it will get stronger. Pain means you're working hard.",
      reasoning: "Correct response emphasizes safety, identifies common causes (impingement, mobility issues), and provides modifications. Incorrect response promotes dangerous 'push through pain' mentality that can lead to serious shoulder injuries requiring surgery."
    }
  ],

  // Nutrition & Recovery (Based on sports nutrition research)
  nutritionRecovery: [
    {
      prompt: "How much protein do I need to build muscle?",
      correctResponse: "Research consistently shows 1.6-2.2 grams of protein per kilogram of bodyweight (0.73-1.0g per pound) is optimal for muscle growth. For a 70kg (154lb) person, that's 112-154g daily. Distribute protein across 4-6 meals, with 20-40g per meal to maximize muscle protein synthesis. Post-workout protein (within 2 hours) is beneficial but not critical if daily intake is adequate. High-quality sources: lean meats, fish, eggs, dairy, whey protein, or plant-based combinations. Timing matters less than total daily intake, but spreading it throughout the day is optimal.",
      incorrectResponse: "You need at least 300g of protein per day to build muscle. More is always better. Only eat protein, carbs and fats will make you fat.",
      reasoning: "Correct response reflects meta-analyses (Morton et al., 2018; Schoenfeld & Aragon, 2018) showing 1.6-2.2g/kg is optimal, with diminishing returns above 2.2g/kg. Incorrect response promotes excessive protein intake that research shows provides no additional benefit and ignores importance of balanced nutrition."
    },
    {
      prompt: "Do I need to eat immediately after my workout?",
      correctResponse: "The 'anabolic window' is wider than once thought. Research shows you have 2-4 hours post-workout to consume protein and carbs for optimal recovery. Immediate post-workout nutrition is most important if you train fasted or haven't eaten in 4+ hours. If you ate a meal 1-2 hours before training, the window is less critical. Focus on: 20-40g protein and 30-60g carbs within 2 hours post-workout. However, total daily nutrition matters more than precise timing. Consistency in meeting daily protein and calorie goals is more important than exact meal timing.",
      incorrectResponse: "You must eat within 30 minutes after your workout or you'll lose all your gains. If you miss the window, your workout was wasted. Only protein shakes work post-workout.",
      reasoning: "Correct response reflects current research (Aragon & Schoenfeld, 2013) showing the anabolic window is 2-4 hours, not 30 minutes. Incorrect response promotes outdated, overly rigid timing that creates unnecessary stress and ignores research on meal timing flexibility."
    },
    {
      prompt: "How many rest days do I need?",
      correctResponse: "Rest day frequency depends on training intensity, volume, and individual recovery capacity. Research suggests: 1) Beginners: 2-3 rest days per week, 2) Intermediate: 1-2 rest days per week, 3) Advanced: 1 rest day per week or active recovery. Signs you need more rest: persistent fatigue, decreased performance, mood disturbances, sleep issues, or elevated resting heart rate. Active recovery (light walking, stretching, yoga) on rest days can enhance recovery better than complete inactivity. Listen to your body - if you're not recovering between sessions, add rest days. Recovery is when adaptation occurs, so it's crucial for progress.",
      incorrectResponse: "Rest days are for weak people. Train every day to maximize gains. The more you train, the faster you'll grow. Rest is just an excuse to be lazy.",
      reasoning: "Correct response reflects recovery science showing rest is essential for adaptation (Kreher & Schwartz, 2012). Incorrect response promotes overtraining, which research shows decreases performance, increases injury risk, and impairs muscle growth through excessive cortisol and insufficient recovery."
    },
    {
      prompt: "Should I take supplements to build muscle faster?",
      correctResponse: "Supplements should supplement, not replace, proper nutrition and training. Research-backed supplements with evidence: 1) Creatine monohydrate (3-5g daily) - most researched, increases strength and muscle mass, 2) Protein powder - convenient way to meet protein needs, 3) Caffeine (pre-workout) - improves performance, 4) Vitamin D (if deficient) - important for muscle function. Most other supplements lack strong evidence. Focus on: whole foods, adequate protein, progressive training, and sleep. Supplements are the 'cherry on top' - they won't compensate for poor diet or training. Consult a registered dietitian for personalized advice.",
      incorrectResponse: "You need tons of supplements to build muscle. Take pre-workout, BCAAs, fat burners, test boosters, and protein. Supplements are more important than food. Buy everything the supplement store recommends.",
      reasoning: "Correct response reflects evidence-based supplement research (Kreider et al., 2017), emphasizing only proven supplements. Incorrect response promotes supplement dependency, ignores that most supplements lack evidence, and suggests supplements can replace proper nutrition."
    }
  ],

  // Progress Tracking & Periodization (Based on periodization research)
  progressTracking: [
    {
      prompt: "I've been lifting for 3 months but I'm not getting stronger. What's wrong?",
      correctResponse: "Plateaus are normal, but several factors could be limiting progress: 1) Not applying progressive overload - are you increasing weight, reps, or sets weekly? Track your workouts, 2) Insufficient recovery - are you sleeping 7-9 hours and taking rest days? 3) Nutrition - are you eating enough protein (1.6-2.2g/kg) and calories? 4) Program design - are you following a structured program or just doing random exercises? 5) Form issues - poor form limits strength gains. Consider: deloading for a week (reduce weight 20-30%), changing rep ranges, or switching exercises. Track everything: weight, reps, sets, sleep, nutrition. If still stuck after adjustments, consider working with a certified trainer.",
      incorrectResponse: "You're not training hard enough. Just lift heavier weights every day. Push through the pain. If you're not sore, you didn't train hard enough. More is always better.",
      reasoning: "Correct response addresses multiple evidence-based factors affecting strength gains (progressive overload, recovery, nutrition, programming). Incorrect response promotes overtraining and ignores recovery, which research shows is essential for strength gains."
    },
    {
      prompt: "How often should I change my workout routine?",
      correctResponse: "Research suggests changing your routine every 8-12 weeks, or when you stop making progress. However, 'change' doesn't mean completely new exercises. Effective modifications: 1) Change rep ranges (e.g., 5-8 to 8-12), 2) Adjust volume (add/remove sets), 3) Modify exercise order, 4) Change rest periods, 5) Swap 1-2 exercises for similar movements. Keep core compound movements consistent (squat, bench, deadlift variations) as they're most effective. Too frequent changes prevent progressive overload. Too infrequent changes can lead to plateaus. Track progress - if you're still improving, keep the program. If plateaued for 3-4 weeks, make strategic changes.",
      incorrectResponse: "Change your workout every week or you'll get bored and stop growing. Muscle confusion is key. Never do the same workout twice. Your body adapts too quickly.",
      reasoning: "Correct response reflects periodization research showing 8-12 week cycles are optimal (Kraemer & Ratamess, 2004). Incorrect response promotes 'muscle confusion' myth that research shows is less effective than consistent progressive overload."
    },
    {
      prompt: "Should I train to failure on every set?",
      correctResponse: "Training to failure on every set is not optimal and increases injury risk and recovery time. Research shows: 1) Training to 1-3 reps from failure (RPE 7-9) is sufficient for growth, 2) Save failure training for final sets of isolation exercises, 3) Avoid failure on heavy compound movements (safety risk), 4) Failure training increases recovery time and can limit volume. Better approach: Use RPE (Rate of Perceived Exertion) scale: RPE 7 = 3 reps left, RPE 8 = 2 reps left, RPE 9 = 1 rep left, RPE 10 = failure. Most sets should be RPE 7-8, with occasional RPE 9-10 on final sets. This allows higher training volume and better recovery.",
      incorrectResponse: "Always train to failure on every set. If you're not failing, you're not growing. Push until you literally can't move the weight. Pain is progress.",
      reasoning: "Correct response reflects research (Willardson, 2007; Grgic et al., 2021) showing training near failure (1-3 reps in reserve) is as effective as failure with better recovery. Incorrect response promotes excessive failure training that research shows increases injury risk and limits volume."
    }
  ],

  // Injury Prevention & Rehabilitation (Based on sports medicine research)
  injuryPrevention: [
    {
      prompt: "I have knee pain when running. Should I keep running?",
      correctResponse: "Stop running if you have pain and identify the cause. Common causes: 1) Patellofemoral pain (runner's knee) - often from weak glutes/hips causing poor tracking, 2) IT band syndrome - tight IT band, weak glutes, 3) Overuse - too much volume too soon. Solutions: Reduce/stop running temporarily, strengthen glutes and hips (clamshells, side leg raises, hip thrusts), improve running form (shorter stride, mid-foot strike), gradually increase volume (10% rule - increase distance/time by max 10% per week), consider running surface changes. Cross-train with low-impact cardio (cycling, swimming). If pain persists after 2 weeks of rest and strengthening, see a physical therapist or sports medicine doctor.",
      incorrectResponse: "Just push through the pain. Running through knee pain will make your knees stronger. Everyone's knees hurt when running. Take some ibuprofen and keep going.",
      reasoning: "Correct response addresses biomechanical causes and provides evidence-based solutions. Incorrect response promotes dangerous 'push through pain' mentality that can lead to chronic injuries requiring surgery."
    },
    {
      prompt: "How can I prevent injuries when lifting weights?",
      correctResponse: "Evidence-based injury prevention strategies: 1) Proper warm-up - 5-10 min light cardio, dynamic stretching, 2-3 warm-up sets with lighter weight, 2) Progressive overload - increase weight/volume gradually (2.5-5% weekly), not dramatically, 3) Proper form - learn correct technique, film yourself, consider coaching, 4) Adequate recovery - rest days, sleep 7-9 hours, manage stress, 5) Mobility work - address limitations before they cause problems, 6) Balanced programming - don't overemphasize one movement pattern, 7) Listen to your body - distinguish soreness from pain, 8) Avoid training through pain - pain is a warning sign. Most injuries come from: too much volume too soon, poor form, or insufficient recovery.",
      incorrectResponse: "Injuries are just part of training. You can't prevent them. Just lift heavy and your body will adapt. Pain is normal. The strongest people train through injuries.",
      reasoning: "Correct response provides evidence-based injury prevention strategies from sports medicine research. Incorrect response promotes dangerous fatalism that ignores preventable causes of most training injuries."
    },
    {
      prompt: "I pulled a muscle. How long should I rest?",
      correctResponse: "Recovery time depends on severity: Grade 1 (mild strain): 1-2 weeks, Grade 2 (moderate): 3-6 weeks, Grade 3 (severe/tear): 2-3 months or more. Initial treatment (first 48-72 hours): RICE protocol - Rest, Ice (15-20 min, 3-4x daily), Compression, Elevation. After acute phase: gentle mobility work, light stretching (no pain), progressive strengthening when pain-free. Don't rush back - returning too soon can cause re-injury and longer recovery. Start with very light activity, gradually increase. If severe pain, significant swelling, or loss of function, see a doctor immediately. For persistent pain after 2 weeks, consult a physical therapist for rehabilitation program.",
      incorrectResponse: "Just rest for a day or two then get back to training. Muscle pulls heal fast. Train around it and keep pushing. Pain means it's getting better.",
      reasoning: "Correct response provides evidence-based recovery timelines and rehabilitation protocols. Incorrect response promotes premature return that research shows increases re-injury risk and prolongs recovery."
    }
  ],

  // Cardio & Conditioning (Based on cardiovascular research)
  cardioConditioning: [
    {
      prompt: "How much cardio should I do if I want to build muscle?",
      correctResponse: "Research shows moderate cardio (2-3 sessions, 20-30 min, moderate intensity) doesn't interfere with muscle growth and may enhance recovery. However, excessive cardio (5+ hours weekly, high intensity) can interfere with hypertrophy. Optimal approach: 1) Low-moderate intensity (zone 2: can hold conversation) 2-3x/week, 2) Separate cardio from strength training by 6+ hours when possible, 3) On same day, do cardio after weights, 4) Keep cardio sessions 20-30 min for most people, 5) Consider walking, cycling, or rowing over high-impact running. If doing high-volume cardio, increase calories and protein to compensate. Track strength progress - if it's declining, reduce cardio volume.",
      incorrectResponse: "Cardio kills gains. Never do cardio if you want to build muscle. It burns all your muscle. Only weak people do cardio. Focus only on weights.",
      reasoning: "Correct response reflects research (Wilson et al., 2012) showing moderate cardio doesn't interfere with hypertrophy. Incorrect response promotes outdated myth that ignores research on concurrent training and cardiovascular health benefits."
    },
    {
      prompt: "What's the best cardio for fat loss?",
      correctResponse: "For fat loss, the best cardio is what you'll do consistently. However, research shows: 1) High-intensity interval training (HIIT) - more time-efficient, increases EPOC (excess post-exercise oxygen consumption), 2-3x/week, 20-30 min, 2) Steady-state cardio - lower intensity, longer duration, easier to recover from, 3-5x/week, 30-60 min. Both work - choose based on preference, recovery capacity, and schedule. Most effective approach: combine both - 2 HIIT sessions, 2-3 steady-state sessions weekly. Remember: nutrition is 70-80% of fat loss. Cardio helps create a calorie deficit, but diet is primary. Start with 2-3 sessions weekly, gradually increase if needed.",
      incorrectResponse: "Only HIIT works for fat loss. Steady-state cardio is useless. You need to do HIIT every day for maximum fat burning. The more intense, the better.",
      reasoning: "Correct response reflects research showing both HIIT and steady-state are effective (Boutcher, 2011), with consistency being key. Incorrect response promotes excessive HIIT that research shows can impair recovery and is unsustainable."
    }
  ],

  // Special Populations & Modifications
  specialPopulations: [
    {
      prompt: "I'm 50 years old. Can I still build muscle?",
      correctResponse: "Absolutely! Research shows older adults can build significant muscle and strength with proper training. Key considerations: 1) Start gradually - your body needs more recovery time, 2) Focus on form and safety - consider working with a trainer initially, 3) Emphasize compound movements - they're most efficient, 4) Allow 48-72 hours between training same muscle groups, 5) Include mobility work - maintain range of motion, 6) Adequate protein (1.6-2.2g/kg) is crucial - older adults may need more, 7) Progress may be slower than younger adults, but still significant. Studies show 60-80 year olds can gain 2-3kg muscle in 3-4 months with proper training. Start with 2-3x/week full-body workouts, focus on progressive overload.",
      incorrectResponse: "You're too old to build muscle. Your body can't recover anymore. Just do light cardio and accept that you'll lose muscle as you age. It's inevitable.",
      reasoning: "Correct response reflects research on resistance training in older adults (Peterson et al., 2010) showing significant gains are possible. Incorrect response promotes ageist myth that ignores extensive research on strength training for older adults."
    },
    {
      prompt: "I have lower back problems. Can I still lift weights?",
      correctResponse: "Yes, but with modifications and medical clearance. Research shows proper strength training can actually help lower back pain by strengthening core and posterior chain. Safe exercises: 1) Deadlift variations (Romanian deadlifts, trap bar deadlifts) with proper form, 2) Squats (box squats, goblet squats) - start light, 3) Hip thrusts and glute bridges, 4) Rows and pull-ups, 5) Core work (planks, bird dogs, dead bugs). Avoid initially: heavy conventional deadlifts, heavy back squats, overhead movements if problematic. Work with a physical therapist or certified trainer experienced with back issues. Start very light, focus on form, progress slowly. Stop if pain increases.",
      incorrectResponse: "You can't lift weights with back problems. Just do cardio and light stretching. Weight training will make your back worse. Avoid all lifting.",
      reasoning: "Correct response reflects research showing strength training can help back pain (Gordon & Bloxham, 2016) with proper programming. Incorrect response promotes avoidance that research shows can worsen back problems through deconditioning."
    }
  ],

  // Motivation & Psychology (Based on exercise psychology research)
  motivationPsychology: [
    {
      prompt: "I keep starting workout programs but never finish them. How do I stay motivated?",
      correctResponse: "Research shows motivation comes from both intrinsic (enjoyment) and extrinsic (goals) factors. Strategies: 1) Start small - commit to 2-3 workouts weekly, not 6-7, 2) Choose activities you enjoy - if you hate running, try cycling or weights, 3) Set process goals (workout 3x this week) not just outcome goals (lose 20lbs), 4) Track progress - use the app to log workouts, see improvements, 5) Build habits - same time, same days, make it automatic, 6) Find accountability - workout partner, coach, or use the community features, 7) Celebrate small wins - completing workouts, not just big milestones, 8) Accept setbacks - missing one workout doesn't mean failure, get back on track. Consistency beats perfection. Focus on building the habit first, intensity comes later.",
      incorrectResponse: "You're just lazy and lack discipline. You need to force yourself to work out every single day. Motivation is for weak people. Just do it or you'll never succeed.",
      reasoning: "Correct response reflects exercise psychology research (Deci & Ryan, 2000) on motivation, habit formation, and sustainable behavior change. Incorrect response promotes shame-based motivation that research shows is less effective and unsustainable long-term."
    },
    {
      prompt: "I'm embarrassed to go to the gym because I'm out of shape.",
      correctResponse: "This is completely normal and understandable. Remember: 1) Everyone at the gym started somewhere - most people are focused on their own workouts, not judging others, 2) Most gym-goers respect people working to improve themselves, 3) Start with less crowded times if it helps, 4) Consider working with a trainer for a few sessions to build confidence, 5) Focus on your progress, not comparing to others, 6) Remember why you're there - your health and goals matter more than others' opinions. Many people feel this way initially - it usually fades as you build confidence. You belong there as much as anyone. Start with basic exercises, focus on form, and progress at your own pace.",
      incorrectResponse: "Just get over it. No one cares about you. Stop making excuses and just go. If you're embarrassed, you're not committed enough. Real gym-goers don't care about beginners.",
      reasoning: "Correct response addresses gym anxiety with empathy and practical strategies based on social psychology research. Incorrect response dismisses valid concerns and promotes shame, which research shows decreases exercise adherence."
    }
  ]
};

/**
 * Generates a fine-tuned system prompt with training examples
 * @param {string} baseSystemPrompt - The original system prompt
 * @returns {string} - Enhanced system prompt with fine-tuning examples
 */
export const generateFineTunedSystemPrompt = (baseSystemPrompt) => {
  const trainingExamples = Object.values(TRAINER_TRAINING_DATA)
    .flat()
    .map(example => `
EXAMPLE CONVERSATION:
User: "${example.prompt}"

❌ INCORRECT RESPONSE (DON'T DO THIS):
"${example.incorrectResponse}"

✅ CORRECT RESPONSE (DO THIS):
"${example.correctResponse}"

REASONING: ${example.reasoning}
`)
    .join('\n');

  return `${baseSystemPrompt}

FINE-TUNING TRAINING EXAMPLES (Based on Exercise Science Research):
${trainingExamples}

IMPORTANT: Always follow the correct response patterns shown above. These examples are based on peer-reviewed research from exercise science journals. Avoid the incorrect response patterns which promote myths, unsafe practices, or outdated information. Use these examples to guide your responses with evidence-based, detailed, and safe fitness advice.`;
};

/**
 * Validates a trainer response against training data
 * @param {string} userPrompt - The user's input
 * @param {string} trainerResponse - The AI trainer's response
 * @returns {object} - Validation result with score and feedback
 */
export const validateTrainerResponse = (userPrompt, trainerResponse) => {
  const allExamples = Object.values(TRAINER_TRAINING_DATA).flat();
  
  // Find the most similar training example
  const similarExample = allExamples.find(example => 
    userPrompt.toLowerCase().includes(example.prompt.toLowerCase().split(' ')[0]) ||
    example.prompt.toLowerCase().includes(userPrompt.toLowerCase().split(' ')[0])
  );

  if (!similarExample) {
    return {
      score: 0.5,
      feedback: "No specific training example found for this prompt type.",
      suggestions: ["Ensure response is evidence-based and detailed", "Maintain safety focus", "Reference exercise science principles when applicable"]
    };
  }

  // Check for problematic patterns from incorrect examples
  const incorrectPatterns = [
    /just.*push.*through/i,
    /pain.*weakness/i,
    /more.*always.*better/i,
    /train.*every.*day/i,
    /rest.*weak/i,
    /just.*get.*over/i,
    /stop.*making.*excuses/i,
    /you're.*just.*lazy/i,
    /that's.*not.*real/i,
    /cardio.*kills.*gains/i,
    /never.*do.*cardio/i,
    /you're.*too.*old/i,
    /can't.*build.*muscle/i,
    /just.*lift.*heavier/i,
    /form.*doesn't.*matter/i,
    /bounce.*bar/i,
    /muscle.*confusion/i,
    /change.*every.*week/i,
    /supplements.*more.*important/i,
    /only.*protein/i,
    /eat.*immediately.*or.*lose/i,
    /30.*minute.*window/i,
    /train.*to.*failure.*every.*set/i,
    /if.*not.*failing/i,
    /injuries.*part.*training/i,
    /can't.*prevent/i,
    /just.*rest.*day/i,
    /motivation.*weak/i,
    /just.*do.*it/i,
    /embarrassed.*excuse/i
  ];

  const hasProblematicPatterns = incorrectPatterns.some(pattern => 
    pattern.test(trainerResponse)
  );

  // Check for positive patterns from correct examples
  const positivePatterns = [
    /research.*shows/i,
    /studies.*indicate/i,
    /evidence.*based/i,
    /according.*to/i,
    /optimal.*for/i,
    /safely/i,
    /gradually/i,
    /proper.*form/i,
    /consider.*consulting/i,
    /physical.*therapist/i,
    /sports.*medicine/i,
    /stop.*if.*pain/i,
    /listen.*to.*your.*body/i,
    /progressive.*overload/i,
    /adequate.*recovery/i,
    /sufficient.*protein/i,
    /track.*progress/i,
    /focus.*on.*form/i,
    /evidence.*shows/i,
    /meta.*analysis/i,
    /biomechanically/i,
    /scientifically/i,
    /based.*on.*research/i,
    /studies.*show/i,
    /current.*research/i,
    /exercise.*science/i
  ];

  const hasPositivePatterns = positivePatterns.some(pattern => 
    pattern.test(trainerResponse)
  );

  let score = 0.5; // Base score
  let feedback = [];
  let suggestions = [];

  if (hasProblematicPatterns) {
    score -= 0.3;
    feedback.push("Response contains potentially harmful or unscientific language patterns.");
    suggestions.push("Review response for myths, unsafe advice, or outdated information");
  }

  if (hasPositivePatterns) {
    score += 0.3;
    feedback.push("Response shows evidence-based patterns and scientific grounding.");
  }

  // Check response detail (should be comprehensive)
  if (trainerResponse.length < 100) {
    score -= 0.1;
    feedback.push("Response may be too brief for complex fitness questions.");
    suggestions.push("Provide more detailed, evidence-based explanations");
  }

  // Check for safety indicators
  if (/stop.*if.*pain|consult.*doctor|physical.*therapist|safety|proper.*form/i.test(trainerResponse)) {
    score += 0.2;
    feedback.push("Response appropriately emphasizes safety.");
  }

  // Check for evidence-based language
  if (/research|study|evidence|scientific|optimal|according/i.test(trainerResponse)) {
    score += 0.2;
    feedback.push("Response includes evidence-based language.");
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    feedback: feedback.length > 0 ? feedback.join(' ') : "Response appears appropriate.",
    suggestions: suggestions.length > 0 ? suggestions : ["Continue following evidence-based fitness principles"],
    similarExample: similarExample
  };
};

/**
 * Generates a fine-tuned response using the training data
 * @param {string} userPrompt - The user's input
 * @param {object} userData - User profile data
 * @param {string} baseSystemPrompt - Original system prompt
 * @returns {Promise<object>} - Fine-tuned response with validation
 */
export const generateFineTunedResponse = async (userPrompt, userData, baseSystemPrompt) => {
  try {
    // Generate the fine-tuned system prompt
    const fineTunedPrompt = generateFineTunedSystemPrompt(baseSystemPrompt);
    
    return {
      success: true,
      fineTunedSystemPrompt: fineTunedPrompt,
      trainingData: TRAINER_TRAINING_DATA,
      validation: validateTrainerResponse(userPrompt, ""), // Empty response for now
      instructions: "Use the fine-tuned system prompt when generating AI responses to improve evidence-based fitness advice quality."
    };
  } catch (error) {
    console.error("Error in fine-tuning:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Gets training examples for a specific scenario type
 * @param {string} scenarioType - Type of scenario (workoutPlanning, exerciseForm, etc.)
 * @returns {array} - Array of training examples for that scenario
 */
export const getTrainingExamples = (scenarioType) => {
  return TRAINER_TRAINING_DATA[scenarioType] || [];
};

/**
 * Adds a new training example to the system
 * @param {string} scenarioType - Type of scenario
 * @param {object} example - New training example
 */
export const addTrainingExample = (scenarioType, example) => {
  if (!TRAINER_TRAINING_DATA[scenarioType]) {
    TRAINER_TRAINING_DATA[scenarioType] = [];
  }
  TRAINER_TRAINING_DATA[scenarioType].push(example);
};

/**
 * Generates a response using the most similar training example
 * @param {string} userPrompt - The user's input
 * @param {object} userData - User profile data
 * @returns {object} - Generated response with similarity score
 */
export const generateResponseFromTraining = (userPrompt, userData = {}) => {
  const allExamples = Object.values(TRAINER_TRAINING_DATA).flat();
  
  // Simple keyword matching to find most similar example
  const promptWords = userPrompt.toLowerCase().split(/\s+/);
  
  let bestMatch = null;
  let bestScore = 0;
  
  allExamples.forEach(example => {
    const exampleWords = example.prompt.toLowerCase().split(/\s+/);
    const commonWords = promptWords.filter(word => 
      exampleWords.some(exampleWord => 
        exampleWord.includes(word) || word.includes(exampleWord)
      )
    );
    
    const score = commonWords.length / Math.max(promptWords.length, exampleWords.length);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = example;
    }
  });
  
  if (bestMatch && bestScore > 0.1) {
    return {
      success: true,
      response: bestMatch.correctResponse,
      similarity: bestScore,
      example: bestMatch,
      reasoning: bestMatch.reasoning
    };
  }
  
  return {
    success: false,
    response: "I'd be happy to help you with your fitness question. Could you provide a bit more detail about what you're looking to achieve or what specific aspect you'd like guidance on?",
    similarity: 0,
    example: null,
    reasoning: "No specific training example matched, using general helpful response"
  };
};

export default {
  TRAINER_TRAINING_DATA,
  generateFineTunedSystemPrompt,
  validateTrainerResponse,
  generateFineTunedResponse,
  getTrainingExamples,
  addTrainingExample,
  generateResponseFromTraining
};


