// "How GymCoach works" (English): what the app does and the choices behind the calculations.
// Every section has an id, so the app can jump straight to a part. Same ids as explain.nl.js.

export default [
  {
    id: 'starten', title: 'New: connecting',
    html: `<p>Three connections put GymCoach to work. Speediance is required for the plan and the workouts. The scale and Apple Health can wait: without those readings, Body, the health score and activities stay empty.</p>
    <h4>Speediance account</h4>
    <ol>
      <li>Open <b>Settings → Speediance account</b>.</li>
      <li>Enter the email and password of your Speediance account. In Europe the region is usually <b>EU</b>.</li>
      <li>Choose your Gym Monster, or tap <b>Detect my machine</b>.</li>
      <li><b>Save and test</b>. GymCoach then fetches the exercise catalogue of that machine.</li>
    </ol>
    <p>The password stays on your own server. Then set your goal, days and minutes under Training, and make your first week plan.</p>
    <h4>Withings scale</h4>
    <p>This has two parts. First the administrator creates a connection at Withings, once. Then each user connects their own scale. The keys are not on the scale and not in the Withings app on your phone. Withings creates them on the developer site.</p>
    <p><b>Once, by the administrator</b></p>
    <ol>
      <li>Go to <b>developer.withings.com</b> and log in with a Withings account.</li>
      <li>Open <b>Dashboard</b> and choose <b>Create an application</b>. Type: <b>Public API</b>. Name the app, for example GymCoach.</li>
      <li>Withings then shows a <b>Client ID</b> and a <b>Client secret</b>. Those are the keys. Copy them and keep that page open until they are in GymCoach.</li>
      <li>In GymCoach: <b>Settings → Withings</b>. You only see the <b>Withings app</b> block if you are the administrator.</li>
      <li>Next to Callback URL, click <b>Fill in this page's address</b>. An address appears that ends in <code>/api/withings/callback</code>. Click <b>Copy</b> and paste it into the callback field at Withings. It has to be exactly the same.</li>
      <li>Paste the Client ID and Client secret into GymCoach and click <b>Save</b>.</li>
    </ol>
    <p><b>Then, by each user</b>, including the administrator</p>
    <ol>
      <li>Stay on <b>Settings → Withings</b>.</li>
      <li>Click the orange button <b>Connect Withings</b>. A Withings page opens.</li>
      <li>Log in with the Withings account that owns the scale, the same account as in the Withings app on your phone. Allow access.</li>
      <li>You see <b>Withings connected</b>. Close that tab. GymCoach then shows <b>connected</b> and the measurements have been fetched.</li>
    </ol>
    <p>If the <b>Connect Withings</b> button is missing, the administrator has not saved the Client ID and Client secret yet. You do not change anything on the scale itself. Weigh as usual, fasted if you can, in the morning, before showering. The resting heart rate on the scale is a standing snapshot.</p>
    <h4>Apple Health</h4>
    <p>You create the connection key yourself in GymCoach. You do not look it up anywhere else. It starts with <code>gch_</code> and is shown only once. If you lose it, click <b>New key</b>. The old one stops working.</p>
    <p><b>On the computer, in GymCoach</b></p>
    <ol>
      <li>Go to <b>Settings → Apple Health</b>.</li>
      <li>Click <b>Create connection key</b>.</li>
      <li>A green box appears with two lines. The <b>URL</b> line ends in <code>/api/health/ingest</code>. Do not paste that whole line into the iPhone. You need your GymCoach address, without that ending. For example <code>https://gymcoach.stolding.com</code>, or at home <code>http://192.168.1.50:8765</code>.</li>
      <li>The other line is the key. Click <b>Copy key</b> and keep it until it is on the iPhone.</li>
    </ol>
    <p><b>On the iPhone, in GymCoach Sync</b></p>
    <p>The app has two addresses. Do not mix them up. The buttons on the iPhone are in Dutch.</p>
    <ol>
      <li>Install <b>GymCoach Sync</b> through TestFlight and open the app.</li>
      <li>To look at the plan, log in with your GymCoach site address, your username and your GymCoach password. That is not the connection key.</li>
      <li>To send Apple Health: tab <b>Meer</b> → <b>Synchroniseren</b>. Enter the same address there, without <code>/api/health/ingest</code>. In <b>Koppelsleutel</b>, paste the key that starts with <code>gch_</code>. Tap <b>Toon</b> if you want to check it.</li>
      <li>Tap <b>Test verbinding</b>. The iPhone asks for access to Health. Allow what GymCoach asks: workouts, heart rate, steps, energy, distance, resting heart rate, HRV, VO2max and nutrition.</li>
      <li>Then tap <b>Volledige historie versturen</b> once, so older walks and days are included. After that, new data goes by itself, at most once an hour.</li>
    </ol>
    <p><b>Automatisch alleen thuis</b> means: only on wifi, and only when your server is reachable. Turn it off if you use GymCoach over the internet. <b>Test verbinding</b> and <b>Nu synchroniseren</b> still work.</p>
    <p>GymCoach Sync reads workouts (walking, cycling and the rest), heart rate, steps, active energy, distance, resting heart rate, HRV, VO2max and nutrition. Strength workouts that Speediance itself writes to Apple Health are skipped, so nothing is counted twice. Prefer another app: under Settings → Apple Health, <b>Or: set up Health Auto Export</b> explains where that same URL and key go. The key belongs in the <code>Authorization</code> header, as <code>Bearer</code> followed by the key.</p>
    <p>The Apple Watch resting heart rate is the day value. GymCoach uses it once there are enough days; otherwise it uses the scale.</p>`,
  },
  {
    id: 'kort', title: 'In short',
    html: `<ol>
      <li><b>Fetch.</b> GymCoach fetches your workouts from your Speediance account: per exercise the sets, reps, weights, times and (if you wear a heart rate strap) your heart rate.</li>
      <li><b>Plan.</b> A fixed set of rules turns your settings and history into a weekly plan. The AI coach (if set up) may then make suggestions, but only within limits, and you decide.</li>
      <li><b>On the machine.</b> With one click a workout is on your Gym Monster as a programme, with weights, reps and rest already filled in.</li>
      <li><b>Look back.</b> A report after every workout; plus Training and Review, together with your Withings measurements and your activities from Apple Health.</li>
    </ol>
    <p>Everything runs on your own server. Your data only goes to Speediance, Withings and Apple (which you connect yourself) and, if you use the AI coach, to the AI service the administrator has chosen.</p>`,
  },
  {
    id: 'schermen', title: 'The screens',
    html: `<p>The screenshots are of a sample user, Sam Demo. The workouts, the scale and Apple Health are made up. An overview of a tab has orange numbers. A close-up of each block follows.</p>
    <h4>Overview</h4>
    <p>This is the start page. A greeting at the top, then the blocks one after another. The pictures show the Dutch app.</p>
    <img class="guide-shot" src="/guide/overzicht.png" alt="Sam Demo's overview, with a number on every block">
    <ol>
      <li><b>Greeting.</b> The date, your name and a tip, such as a record or how many workouts are still open this week.</li>
      <li><b>Recovery and score.</b> On the left, whether you are rested (resting heart rate, HRV, reps you completed). On the right, the health score from 0 to 10, higher is better, with the line across the weeks.</li>
      <li><b>Muscle recovery.</b> The body figure and a line per muscle group. Orange is tired, green has recovered. The buttons turn a muscle group on or off.</li>
      <li><b>Next workout.</b> The next workout that is still open, with the estimated time.</li>
      <li><b>Week goal.</b> The ring counts the sessions in the plan, including a walk. At the weekly goal the circle is full. Do more and a brighter orange ring runs along the outer half, until the whole plan is done.</li>
      <li><b>Streak.</b> How many weeks in a row you hit the week goal.</li>
      <li><b>Volume.</b> Kilograms this week, compared with last week.</li>
      <li><b>Minutes.</b> Training time and kcal this week.</li>
      <li><b>Body.</b> Latest weight, fat percentage and the direction of the last weeks.</li>
      <li><b>Health status.</b> A text from the AI coach about the last four weeks. Without an AI coach this stays on “Maak status”.</li>
      <li><b>Goal.</b> Whether you are on track, with the bar for today's kcal and protein. The button opens the Goal tab.</li>
      <li><b>Strength.</b> Estimated 1RM of your heaviest exercises in the last four weeks, with a small line.</li>
      <li><b>Records.</b> New records from the last fourteen days.</li>
      <li><b>Calendar.</b> Eight weeks. A cell is a training day; the colour is that day's minutes. Click a day for the exercises.</li>
      <li><b>This week's plan.</b> The body figure of the planned load, the number of workouts, the working sets and the heaviest muscle groups.</li>
    </ol>
    <img class="guide-shot" src="/guide/overzicht-herstel.png" alt="Recovery on the left and the health score on the right">
    <p class="guide-cap muted small">Recovery and score side by side. Green means nothing is in the way. The score names what counted, here fat percentage and BMI.</p>
    <img class="guide-shot" src="/guide/overzicht-spieren.png" alt="Muscle recovery with the body figure and lines">
    <p class="guide-cap muted small">Muscle recovery. The figure is the state now. The lines are recovery per day.</p>
    <img class="guide-shot" src="/guide/overzicht-volgende.png" alt="Next workout and the week ring">
    <p class="guide-cap muted small">The next workout on the left, the week-goal ring on the right.</p>
    <img class="guide-shot" src="/guide/overzicht-midden.png" alt="Tiles, health status and goal">
    <p class="guide-cap muted small">The four tiles, then the health status and the goal summary.</p>
    <img class="guide-shot" src="/guide/overzicht-kracht.png" alt="Strength and records">
    <p class="guide-cap muted small">Strength on the left, records on the right.</p>
    <img class="guide-shot" src="/guide/overzicht-kalender.png" alt="Training calendar and this week's plan">
    <p class="guide-cap muted small">Calendar on the left, this week's plan on the right.</p>
    <h4>Plan</h4>
    <p>This is the week that goes onto the Gym Monster. You change it on the computer only.</p>
    <img class="guide-shot" src="/guide/plan.png" alt="Sam Demo's Plan tab">
    <ol>
      <li><b>Header and buttons.</b> The week, the arrows to an older week, and the buttons for a new workout, a new proposal and the AI coach.</li>
      <li><b>Muscles and time.</b> Front and back. The list beside it is the planned time and the sets per muscle group. Click a muscle group to see it on the figure.</li>
      <li><b>Workouts.</b> One card per day: name, minutes, exercises, and whether it is already done. Expanding it shows sets and weights. Below that you send it to the machine, edit it, or replace it.</li>
      <li><b>Templates.</b> Workouts you save yourself, and workouts shared on this server.</li>
      <li><b>Programmes.</b> What is already on your Gym Monster account. You fetch that list with Show programmes.</li>
    </ol>
    <img class="guide-shot" src="/guide/plan-spieren.png" alt="Body figure and the week's muscle list">
    <p class="guide-cap muted small">The week overview: the figure and the split across muscle groups.</p>
    <img class="guide-shot" src="/guide/plan-sessies.png" alt="Three workout cards, two of them already done">
    <p class="guide-cap muted small">The days of the week. A finished session has a solid green border. A bar under the goal shows when you went past it: the extra part is brighter. An outdoor activity that has started but has not met its weekly goal has a dashed orange border. Outdoor cardio has no programme on the machine; that activity comes from Apple Health.</p>
    <h4>Goal</h4>
    <p>What you eat against what fits the goal. The scale itself stays under Body.</p>
    <img class="guide-shot" src="/guide/doel.png" alt="Sam Demo's Goal tab">
    <ol>
      <li><b>Target and today.</b> The calculated kcal and protein, and whether today is already there.</li>
      <li><b>Set a goal.</b> Body (kilograms and weeks), strength per muscle group, steps per day and activities per week. Saving starts the goal again.</li>
      <li><b>Weight.</b> Your measurements and the straight line to the target weight.</li>
      <li><b>Intake.</b> What you ate, against the target-kcal line.</li>
      <li><b>Strength.</b> The index of the chosen muscle group, here the back, against the strength-goal line.</li>
      <li><b>Days.</b> A table per day: workout, steps, intake and whether it stayed inside the goal.</li>
    </ol>
    <img class="guide-shot" src="/guide/doel-formulier.png" alt="The form for setting a goal">
    <p class="guide-cap muted small">The form. Steps and activities sit below it; you see those on the full page above.</p>
    <h4>Body</h4>
    <p>The scale and body composition. No training chart.</p>
    <img class="guide-shot" src="/guide/lichaam.png" alt="Sam Demo's Body tab">
    <ol>
      <li><b>Title.</b> Body weight.</li>
      <li><b>Scale.</b> Whether Withings is connected, and a button to add a measurement yourself.</li>
      <li><b>Health score.</b> The same score as on Overview, here with the categories body, heart, fitness and other.</li>
      <li><b>Composition.</b> Tiles for weight, fat, muscle mass and the scale's other values, with a chart. Green or red follows whether the score gets better or worse, not whether the number went up.</li>
      <li><b>Measurements.</b> The list, collapsed. Opening it shows every weigh-in.</li>
    </ol>
    <h4>Training</h4>
    <p>What you did on the Gym Monster. Click a row for the exercises, sets and weights.</p>
    <img class="guide-shot" src="/guide/training.png" alt="Sam Demo's Training tab">
    <ol>
      <li><b>Title.</b> Training.</li>
      <li><b>Charts.</b> Three side by side: workouts per week, volume per week and minutes per week.</li>
      <li><b>Workouts.</b> The table. A row opens that workout's report.</li>
      <li><b>Per exercise.</b> Pick an exercise. The chart is the estimated 1RM over time.</li>
    </ol>
    <h4>Review</h4>
    <p>Everything for a period you pick at the top right. Print and PDF use that same period. The page is long; the numbers run from top to bottom.</p>
    <img class="guide-shot" src="/guide/terugkijken.png" alt="Sam Demo's Review tab">
    <ol>
      <li><b>Header.</b> The period, plus Print and PDF.</li>
      <li><b>Numbers.</b> Tiles for the period: workouts, per week, time, kcal, streak, favourite day, volume, sets, reps per set, heaviest weight, records and muscle groups.</li>
      <li><b>Cardio.</b> Apple Health activities in this period.</li>
      <li><b>Balance and mass.</b> The volume split on the left, muscle mass against training volume on the right.</li>
      <li><b>Strength.</b> The index per muscle group. 100 is the start of the period. A dot turns a muscle group on or off.</li>
      <li><b>Kilometres and steps.</b> Kilometres per week and steps per day.</li>
      <li><b>Per muscle group.</b> Volume, sets and the best estimated 1RM.</li>
      <li><b>Sets per week.</b> A bar per muscle group. Green is inside the beginner guideline, about 6 to 12 working sets.</li>
      <li><b>Detail.</b> The same muscle groups in a table, per week.</li>
      <li><b>Per exercise.</b> Volume and the heaviest weight per exercise.</li>
      <li><b>Patterns.</b> Which movement patterns (push, pull, squat) you did.</li>
      <li><b>Calendar.</b> The same eight weeks as on Overview, for the chosen period.</li>
      <li><b>When.</b> On which days and hours you train. The tick includes walking and cycling.</li>
      <li><b>Recovery and energy.</b> Whether the load matches your recovery, and burned energy next to weight.</li>
    </ol>
    <h4>Settings</h4>
    <p>The menu on the left, the open section on the right. Sam Demo is not an administrator, so AI coach and Users are missing. You only see those two as an administrator.</p>
    <img class="guide-shot" src="/guide/instellingen.png" alt="Settings, with the Speediance account open">
    <ul>
      <li><b>Speediance account.</b> Email, password, region and Gym Monster. Save and test fetches the catalogue. Detect my machine picks the model.</li>
      <li><b>Training.</b> Goal, days, minutes, experience, deload, warm-up, cool-down and whether the week is one plan.</li>
      <li><b>Body and goals.</b> Sex, year of birth, date of birth, maximum heart rate, figure and height. Those drive the charts and the score.</li>
      <li><b>Apple Health.</b> This is where you create the connection key. How that works is under New: connecting.</li>
      <li><b>Withings.</b> The Connect Withings button. Only the administrator fills in the Client ID.</li>
      <li><b>Email.</b> Your address, and whether you want a PDF after a workout. The administrator sets up the mail server.</li>
      <li><b>Sync and catalogue.</b> When the last sync was, and how many exercises there are for your machine.</li>
      <li><b>Guide.</b> This text.</li>
      <li><b>Terms.</b> The text you accept on the first start.</li>
      <li><b>About GymCoach.</b> Version and licence.</li>
    </ul>`,
  },
  {
    id: 'plan', title: 'The weekly plan',
    html: `<p><b>Schedule.</b> The number of workouts per week sets the split: 2 or 3 days full body (A/B/C), 4 days upper/lower. Each workout fills fixed movement patterns (push, pull, squat, hip hinge, …) with an exercise from your machine's catalogue.</p>
    <p><b>Prescription per goal</b> (working sets):</p>
    <table class="about-tbl"><thead><tr><td></td><td>Compound</td><td>Isolation</td></tr></thead><tbody>
      <tr><td class="muted">Muscle building</td><td>3 × 8–12, 90 s rest</td><td>3 × 10–15, 60 s</td></tr>
      <tr><td class="muted">Combination</td><td>3 × 10–12, 60 s</td><td>3 × 12–15, 45 s</td></tr>
      <tr><td class="muted">Weight loss</td><td>3 × 12–15, 45 s</td><td>2 × 15–20, 30 s</td></tr>
      <tr><td class="muted">Cardio circuit</td><td colspan="2">3 × 15–20, light (60%), 20 s rest</td></tr>
    </tbody></table>
    <p class="muted small">Advanced: one extra set on compound exercises. New exercise: two sessions with 2 sets first, for technique.</p>
    <p><b>Progression</b> (double progression): if you reach the top of the rep range in all sets, the weight goes up (+2 kg compound, +1 kg isolation) and you start at the bottom again. If you reach the bottom, +1 rep. Twice in a row below target: −10%.</p>
    <p><b>Deload.</b> Every so many training weeks (adjustable, default 6) a lighter week: one set less and 10% lighter. Weeks without training do not count.</p>
    <p><b>Accessories.</b> If you do not use an accessory (bar, bench, handles, rope, belt, rowing/ski handle or mat), switch it off under Settings → Training. Exercises that need it will no longer appear in your plan, in swaps or in the AI coach's suggestions. GymCoach derives which accessory an exercise needs from its name (for example <i>Barbell</i>, <i>Rope</i>, <i>Incline</i>, <i>Seated</i>) and the type of exercise.</p>
    <p><b>Focus and time.</b> Focus areas come first and get an extra set as long as the workout stays within your set time. GymCoach estimates the duration at 4 s per rep plus rest.</p>
    <p><b>Edit it yourself.</b> With <i>Edit</i> you change a workout: sets, reps, weight, rest and mode per set (standard, eccentric, isokinetic, constant, spotter), the order, the warm-up and the cool-down. The figure and the sets per muscle group for the whole week update straight away. An edited workout is <i>locked</i>: with a new proposal it stays, and the weights follow your progression, except for exercises with a <i>fixed weight</i>. <i>Delete</i> removes one workout from this week. <i>Replace</i> puts another in its place. The other workouts stay. You can also add a walk, a bike ride, swimming, padel or another activity.</p>
    <p><b>Supersets.</b> Two or more exercises alternated, without rest in between; after each round the rest of the last exercise. On the Gym Monster they appear as alternating steps (A1, A2, A1, A2 …), because a programme has no supersets.</p>
    <p><b>Your own workouts and templates.</b> With <i>+ New workout</i> you build a workout yourself (empty, as a copy or from a template). You save a workout as a template under <i>Workouts</i>, and you can share it with everyone on your server. Whoever puts a shared template in their plan gets weights from their own history, or a starting weight if they have not done the exercise yet.</p>
    <p><b>One week.</b> With <i>Week as one plan</i> on (Settings → Training), an exercise moves to a later day when that prime muscle has not recovered. Upper and lower stay separate, a locked workout stays put, and the weekly total per muscle group stays the same. The plan shows recovery at the start of each workout. Turn the switch off and make a new weekly plan to get the fixed days back.</p>
    <p><b>Previous weeks.</b> GymCoach keeps every weekly plan. With the arrows next to the week title you look back: per exercise what was planned and what you did, with ✓ (achieved), ↓ (fewer sets, reps or weight), ↑ (more) or – (not done). A good workout can be brought back to this week or saved as a template.</p>
    <p><b>Week number.</b> The plan carries the calendar week it was made in, for example <i>GC 2026-W45 Full Body A</i> on your machine.</p>`,
  },
  {
    id: 'persoonlijk', title: 'Men, women and age',
    html: `<p>Research shows that men and women build muscle mass and strength <b>equally fast in relative terms</b>; in the upper body women even progress slightly faster in relative terms (Roberts et al., 2020, meta-analysis). Men do start higher, especially in the upper body. The muscles, exercises and principles are the same for everyone.</p>
    <p>Where it does make a difference, and what GymCoach does with it:</p>
    <ul>
      <li><b>Recovery between sets.</b> Women usually recover faster between sets (in one study they managed almost twice as many reps with short rest; with a single set there was no difference). <i>GymCoach:</i> 20% shorter rest for women.</li>
      <li><b>Volume.</b> Women often tolerate a bit more volume per workout without recovering more slowly. <i>GymCoach:</i> focus exercises up to 5 sets instead of 4, and basic exercises an extra set when time allows (not in a deload week).</li>
      <li><b>Maximum heart rate.</b> For women there is a separate formula that fits better: Gulati, 206 − 0.88 × age. For men and in general: Tanaka, 208 − 0.7 × age. If you know your real maximum from a test, enter it; it always takes precedence.</li>
      <li><b>Your own recovery counts most.</b> Differences between people are larger than between men and women. That is why GymCoach also looks at your own sets: if your reps drop by 20% or more on average in later sets, rest becomes 25% longer; if you hit all your reps in every set three times in a row, slightly shorter (−10%). Rest stays between 30 s (isolation 20 s) and 180 s.</li>
      <li><b>Age.</b> Determines the estimated maximum heart rate, the reference ranges for body fat, the VO2max ranges and pulse wave velocity. The date of birth sets the age in the health status on the measurement day; without a date, the year of birth is used. The AI coach receives your age and sex and knows that strength training becomes extra important for bones and muscle mass from about age 50.</li>
      <li><b>Body figure.</b> The muscle maps show a male, female or neutral figure. Only the shape differs.</li>
    </ul>
    <p class="muted small">With <i>non-binary</i>, <i>other</i> or <i>prefer not to say</i> you choose yourself which table GymCoach uses (or none: then the general values) and which figure you see. What you choose only affects these calculations.</p>`,
  },
  {
    id: 'meten', title: 'How GymCoach measures',
    html: `<dl class="explain-dl">
      <dt>Estimated 1RM</dt><dd>The weight you could lift once, estimated with the Epley formula: weight × (1 + reps ÷ 30). This lets you compare sets with different reps fairly. Per workout the best set counts.</dd>
      <dt>Volume</dt><dd>Reps × kilos, added up over all sets: how much work you did. GymCoach uses the volume the Gym Monster stores per set; for exercises with two handles both sides count (2 × the weight per handle). Weights and estimated 1RM are per handle, as on the machine.</dd>
      <dt>Muscle map</dt><dd>Each exercise counts towards the muscle groups it trains: the main muscle as 1 set, assisting muscles as ½ set.</dd>
      <dt>Strength index</dt><dd>Per muscle group the estimated 1RM relative to the first time in the chosen period (= 100). 110 means 10% stronger.</dd>
      <dt>Balance</dt><dd>Working sets push versus pull, and upper body versus lower body. Around 1 : 1 is balanced.</dd>
      <dt>Records</dt><dd>A record is a workout in which an exercise reached a higher estimated 1RM than ever before.</dd>
      <dt>Comparison in the report</dt><dd>With the average of the last 4 times you did the same workout (the week number in the name does not count), or otherwise your last 4 workouts.</dd>
      <dt>Time under tension and rest</dt><dd>From the times the Gym Monster stores per rep and per pause.</dd>
      <dt>Heart rate</dt><dd>Per set from the Gym Monster (with a heart rate strap); the course over the whole workout, including rest, comes from Apple Health (Apple Watch). Zones: 50–60% of your maximum recovery, 60–70% base, 70–80% aerobic, 80–90% threshold, 90%+ maximum.</dd>
      <dt>Recovery</dt><dd>The recovery score uses your resting heart rate from Apple Health (Apple Watch): the average of the last 7 days against the 4 weeks before. With fewer than 10 of those days, it uses the Withings scale. On Review and on Body, resting heart rate comes from Apple Health as soon as there are days, otherwise from the scale. 3 beats higher: take care; 5 or more: probably not recovered, or you are getting ill.</dd>
      <dt>Body</dt><dd>BMI according to the WHO. Body fat against the tables of Gallagher et al. (2000), by age and sex. FFMI (fat-free mass ÷ height²), with ranges by sex. Pulse wave velocity with ranges by age; a higher value means stiffer vessels. Weight, fat, muscle mass, FFMI, pulse wave velocity and ECW/TBW come from the Withings scale. ECW/TBW is the water outside the cells divided by all body water; below 0.40 is usual, and above that you watch the trend. Resting heart rate, HRV and VO2max on the same page come from the Apple Watch.</dd>
      <dt>Energy and steps</dt><dd>Active energy from Apple Health (what you burn on top of your resting metabolism); without Apple Health the calories of your workouts. Step goal 8,000 per day by default. For walking, swimming and other activities you set a weekly goal on Goal. The suggestion beside it comes from your last four weeks in Apple Health, or from a fixed guideline when that measurement is not there yet.</dd>
      <dt>Health score</dt><dd>A number from 1.0 to 10.0 for your sex and age, on Overview and on Body. Four categories count: body composition, heart and vessels, fitness and recovery, and other. Each reading in a category has equal weight. Weight, fat, muscle mass, FFMI, visceral fat, bone percentage, pulse wave velocity, vascular age, metabolic age, nerve health and the ratio of extracellular to total body water come from the Withings scale, as the average of the last two weigh-ins. Resting heart rate and HRV are seven days from Apple Health; VO2max is the latest Apple Watch estimate. A higher score is always better. For the reading itself, green is the healthier direction: a BMI moving toward 22 is green, a BMI moving further from 22 is red. The score number takes the same colour. This summarises your own numbers. It is not a diagnosis.</dd>
    </dl>
    <p class="muted small">All values are estimates for your own progress, not medical measurements.</p>`,
  },
  {
    id: 'signalen', title: 'Signals: recovery and adjusting',
    html: `<p>GymCoach combines data from different sources. Each signal on its own says little; together they say more.</p>
    <dl class="explain-dl">
      <dt>Slowdown within a set</dt><dd>The Gym Monster stores the time per rep. GymCoach compares the last two reps with the first two. Up to 25% slower is fresh, 25–40% hard, from 40% the set went to the limit. Research on velocity loss shows that stopping around 20–25% favours strength and that going further may give more muscle growth (Hickmott et al. 2022). If you hit all reps but the last ones were 40% or more slower, the weight stays the same one more time. Deliberately slow modes (eccentric, isokinetic) do not count.</dd>
      <dt>Recovery score</dt><dd>From your resting heart rate (Apple Health, the Apple Watch day value; with fewer than 10 days, the scale) and HRV (also Apple Health), the last 7 days against the 4 weeks before, plus the reps you achieved and the slowdown in your last three workouts. Resting heart rate varies about 10% day to day and HRV 10–20% (Buchheit 2014), so one deviating signal means nothing: only when two or more point the same way does the score say <i>take care</i>, and with clear deviations <i>take it easy</i>. You can then make the next workout lighter (10% less weight, one set fewer), and the deload week comes earlier than the fixed rhythm. HRV counts but never decides alone: in strength training, HRV-guided training gave no extra gains (Bittencourt et al. 2024); in endurance training a small benefit (Granero-Gallegos et al. 2020).</dd>
      <dt>Rate of weight loss</dt><dd>When losing weight, GymCoach compares your weekly weight loss with your muscle mass (Withings, last 4 weeks). Athletes losing ~0.7% per week kept their muscle mass; at ~1.4% per week they did not (Garthe et al. 2011). If you go faster than ~1% per week and your muscle mass drops, you get a tip; the plan keeps the training volume up.</dd>
      <dt>Cardio right before strength training</dt><dd>A walk or ride that ended within 3 hours before a strength workout is shown in the report. Combining endurance and strength training costs no muscle mass or maximal strength, but some explosive strength when both are in one session; not with 3 hours or more in between (Schumann et al. 2021).</dd>
      <dt>HRV and VO2max</dt><dd>From the Apple Watch, via GymCoach Sync or Health Auto Export. HRV (SDNN, in ms) differs a lot between people: compare with yourself. VO2max is an Apple Watch estimate and shows what walking and cardio bring. The chart sets that estimate against broad ranges by age and sex.</dd>
    </dl>
    <p class="muted small">These are observations, not a diagnosis. A higher resting heart rate can also mean illness; with complaints, see a doctor.</p>`,
  },
  {
    id: 'ai', title: 'The AI coach',
    html: `<p>The AI coach receives your settings, age and sex, your recent workouts, weight and activities, and the plan made by the rules. It may swap exercises (only from your own catalogue), and adjust sets (2–5), reps (5–20) and weight (at most 15%). Every change is checked and you choose what to accept.</p>
    <p><b>Your own workouts.</b> The coach sees which workouts you built, edited or locked yourself, with their structure (supersets, modes, rest, fixed weight). It only suggests changes there with a reason, and those suggestions are unticked by default. If you accept one, the structure stays: weight and reps shift per set, a fixed weight never changes. With <i>AI advice</i> on a workout you ask for advice on that workout alone.</p>
    <p><b>Health status.</b> On Overview the same connection summarises the measurements of the last 4 weeks: Withings, the Apple Watch and training volume. The instruction assumes a fasted morning measurement, before showering, and a standing resting heart rate on the scale. Sleep duration is not included; GymCoach does not store it. It is not a diagnosis and it does not change the plan.</p>
    <p>The coach answers in your language.</p>
    <p>In case of pain or complaints: see your doctor or a physiotherapist.</p>`,
  },
  {
    id: 'bronnen', title: 'Sources',
    html: `<ul class="small">
      <li>Roberts BM et al. (2020). Sex differences in resistance training: a systematic review and meta-analysis. <i>J Strength Cond Res</i>.</li>
      <li>The effects of biological sex on fatigue during and recovery from resistance exercise. <i>PeerJ</i>.</li>
      <li>Gulati M et al. (2010). Heart rate response to exercise stress testing in asymptomatic women. <i>Circulation</i>.</li>
      <li>Tanaka H et al. (2001). Age-predicted maximal heart rate revisited. <i>J Am Coll Cardiol</i>.</li>
      <li>Gallagher D et al. (2000). Healthy percentage body fat ranges. <i>Am J Clin Nutr</i>.</li>
      <li>Epley B (1985). Poundage chart. <i>Boyd Epley Workout</i>.</li>
      <li>Hickmott LM et al. (2022). The effect of load and volume autoregulation on muscular strength and hypertrophy: a systematic review and meta-analysis. <i>Sports Medicine – Open</i> 8:9.</li>
      <li>Garthe I et al. (2011). Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. <i>Int J Sport Nutr Exerc Metab</i> 21(2).</li>
      <li>Schumann M et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. <i>Sports Med</i>.</li>
      <li>Buchheit M (2014). Monitoring training status with HR measures: do all roads lead to Rome? <i>Front Physiol</i>.</li>
      <li>Bittencourt D et al. (2024). Effects of individualized resistance training prescription with heart rate variability in older women. <i>Front Physiol</i>.</li>
      <li>Granero-Gallegos A et al. (2020). HRV-based training for improving VO2max in endurance athletes. <i>Int J Environ Res Public Health</i> 17:7999.</li>
    </ul>`,
  },
];
