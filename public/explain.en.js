// "How GymCoach works" (English): what the app does and the choices behind the calculations.
// Every section has an id, so the app can jump straight to a part. Same ids as explain.nl.js.

export default [
  {
    id: 'kort', title: 'In short',
    html: `<ol>
      <li><b>Fetch.</b> GymCoach fetches your workouts from your Speediance account: per exercise the sets, reps, weights, times and (if you wear a heart rate strap) your heart rate.</li>
      <li><b>Plan.</b> A fixed set of rules turns your settings and history into a weekly plan. The AI coach (if set up) may then make suggestions, but only within limits, and you decide.</li>
      <li><b>On the machine.</b> With one click a workout is on your Gym Monster as a programme, with weights, reps and rest already filled in.</li>
      <li><b>Look back.</b> A report after every workout; plus statistics, analysis and progress, together with your Withings measurements and your activities from Apple Health.</li>
    </ol>
    <p>Everything runs on your own server. Your data only goes to Speediance, Withings and Apple (which you connect yourself) and, if you use the AI coach, to the AI service the administrator has chosen.</p>`,
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
    <p><b>Edit it yourself.</b> With <i>Edit</i> you change a workout: sets, reps, weight, rest and mode per set (standard, eccentric, isokinetic, constant, spotter), the order, the warm-up and the cool-down. The figure and the sets per muscle group for the whole week update straight away. An edited workout is <i>locked</i>: with a new proposal it stays, and the weights follow your progression, except for exercises with a <i>fixed weight</i>.</p>
    <p><b>Supersets.</b> Two or more exercises alternated, without rest in between; after each round the rest of the last exercise. On the Gym Monster they appear as alternating steps (A1, A2, A1, A2 …), because a programme has no supersets.</p>
    <p><b>Your own workouts and templates.</b> With <i>+ New workout</i> you build a workout yourself (empty, as a copy or from a template). You save a workout as a template under <i>Workouts</i>, and you can share it with everyone on your server. Whoever puts a shared template in their plan gets weights from their own history, or a starting weight if they have not done the exercise yet.</p>
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
      <li><b>Age.</b> Determines the estimated maximum heart rate and the reference ranges for body fat. The AI coach receives your age and sex and knows that strength training becomes extra important for bones and muscle mass from about age 50.</li>
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
      <dt>Recovery</dt><dd>Your resting heart rate over the last 7 days compared with the 4 weeks before. 3 beats higher: take care; 5 or more: probably not recovered, or you are getting ill.</dd>
      <dt>Body</dt><dd>BMI according to the WHO. Body fat against the tables of Gallagher et al. (2000), by age and sex. FFMI (fat-free mass ÷ height²), with ranges by sex from relatively little muscle to exceptionally high. Muscle mass and fat come from the Withings scale.</dd>
      <dt>Energy and steps</dt><dd>Active energy from Apple Health (what you burn on top of your resting metabolism); without Apple Health the calories of your workouts. Step goal 8,000 per day by default.</dd>
    </dl>
    <p class="muted small">All values are estimates for your own progress, not medical measurements.</p>`,
  },
  {
    id: 'signalen', title: 'Signals: recovery and adjusting',
    html: `<p>GymCoach combines data from different sources. Each signal on its own says little; together they say more.</p>
    <dl class="explain-dl">
      <dt>Slowdown within a set</dt><dd>The Gym Monster stores the time per rep. GymCoach compares the last two reps with the first two. Up to 25% slower is fresh, 25–40% hard, from 40% the set went to the limit. Research on velocity loss shows that stopping around 20–25% favours strength and that going further may give more muscle growth (Hickmott et al. 2022). If you hit all reps but the last ones were 40% or more slower, the weight stays the same one more time. Deliberately slow modes (eccentric, isokinetic) do not count.</dd>
      <dt>Recovery score</dt><dd>From your resting heart rate and HRV (last 7 days against the 4 weeks before), the reps you achieved and the slowdown in your last three workouts. Resting heart rate varies about 10% day to day and HRV 10–20% (Buchheit 2014), so one deviating signal means nothing: only when two or more point the same way does the score say <i>take care</i>, and with clear deviations <i>take it easy</i>. You can then make the next workout lighter (10% less weight, one set fewer), and the deload week comes earlier than the fixed rhythm. HRV counts but never decides alone: in strength training, HRV-guided training gave no extra gains (Bittencourt et al. 2024); in endurance training a small benefit (Granero-Gallegos et al. 2020).</dd>
      <dt>Rate of weight loss</dt><dd>When losing weight, GymCoach compares your weekly weight loss with your muscle mass (Withings, last 4 weeks). Athletes losing ~0.7% per week kept their muscle mass; at ~1.4% per week they did not (Garthe et al. 2011). If you go faster than ~1% per week and your muscle mass drops, you get a tip; the plan keeps the training volume up.</dd>
      <dt>Cardio right before strength training</dt><dd>A walk or ride that ended within 3 hours before a strength workout is shown in the report. Combining endurance and strength training costs no muscle mass or maximal strength, but some explosive strength when both are in one session; not with 3 hours or more in between (Schumann et al. 2021).</dd>
      <dt>HRV and VO2max</dt><dd>From the Apple Watch, via GymCoach Sync or Health Auto Export. HRV (SDNN, in ms) differs a lot between people: compare with yourself. VO2max is an Apple Watch estimate and shows what walking and cardio bring.</dd>
    </dl>
    <p class="muted small">These are observations, not a diagnosis. A higher resting heart rate can also mean illness; with complaints, see a doctor.</p>`,
  },
  {
    id: 'ai', title: 'The AI coach',
    html: `<p>The AI coach receives your settings, age and sex, your recent workouts, weight and activities, and the plan made by the rules. It may swap exercises (only from your own catalogue), and adjust sets (2–5), reps (5–20) and weight (at most 15%). Every change is checked and you choose what to accept.</p>
    <p><b>Your own workouts.</b> The coach sees which workouts you built, edited or locked yourself, with their structure (supersets, modes, rest, fixed weight). It only suggests changes there with a reason, and those suggestions are unticked by default. If you accept one, the structure stays: weight and reps shift per set, a fixed weight never changes. With <i>AI advice</i> on a workout you ask for advice on that workout alone.</p>
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
