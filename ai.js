const AI_MODEL = 'openai/gpt-4o-mini:free';

const LADDER = {
  projects:["Add one new feature to the project","Write a test or squash a real bug",
            "Deploy it somewhere public","Write a clean README and put it on your resume",
            "Add it to a portfolio page"],
  jobhunt:["Send one more tailored application","Customize your resume for a specific role",
           "Send a referral or cold DM to someone at a target company",
           "Do one mock interview question out loud","Apply to one reach company"],
  gradschool:["Read one paper in your target area","Email a potential advisor",
              "Draft a paragraph of your statement of purpose","Shortlist one more program",
              "Write a short research note"],
  fitness:["Add 5 minutes to your workout","Increase reps or weight on one lift",
           "Add a new exercise","Fit in one extra session this week"],
  nutrition:["Cook one meal instead of ordering","Hit your protein target today",
             "Cut one junk snack","Prep tomorrow's meals tonight"],
  sleep:["Go to bed 15 minutes earlier","No screens 30 min before bed",
         "Wake at the same time tomorrow","Hold the schedule through the weekend"],
};

function getRuleSuggestion(skillId, skillLevel) {
  const ladder = LADDER[skillId] || [];
  const idx = Math.min(skillLevel - 1, ladder.length - 1);
  return ladder[Math.max(0, idx)];
}

async function getAISuggestion(skillId, recentTasks, skillLevel, streak, apiKey) {
  if (!apiKey || streak < 3) return { title: getRuleSuggestion(skillId, skillLevel), difficulty: 'Rare', reasoning: 'rule-based' };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `I am leveling up my ${skillId} skill (level ${skillLevel}, ${streak}-day streak). Recent tasks: ${recentTasks.map(t=>t.title).join(', ')}. Suggest ONE concrete next task that is a genuine escalation. Reply only with JSON: {"title":"...","difficulty":"Common|Rare|Epic|Legendary","reasoning":"one sentence"}`
        }]
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  } catch(e) {
    return { title: getRuleSuggestion(skillId, skillLevel), difficulty: 'Rare', reasoning: 'rule-based fallback' };
  }
}
