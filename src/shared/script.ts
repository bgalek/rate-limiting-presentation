export type ScriptLine = { role: 'bad' | 'good'; text: string }

export const SCRIPT: ScriptLine[] = [
  { role: 'bad', text: `Your edge proxy IP block is cute, but my botnet has 10,000 IPs. (Runs a quick script that utilizes rotating proxies). Server is overloaded.` },
  { role: 'good', text: `Flips a configuration switch to enforce Identity-Based Limiting (e.g., API Key or JWT) rather than IP limits, using a standard Fixed Window algorithm ( e.g. let's say 100 requests/minute)` },
  { role: 'bad', text: `"I can still do something with what I have. I will just time my requests on the edge of the windows. See? I stayed within your limits, but I just hit you with 200 requests in two seconds. Your database is about to time out ;)"` },
  { role: 'good', text: `Upgrades the defense to a Sliding Window Log/Counter! (Visually demonstrate how the window now moves fluidly with time neutralizing the boundary spike)` },
  { role: 'bad', text: `Okay, you defeated me on the volume front... Then I'll change tactics. (Sends exactly 10 requests per minute (well under the limit) but points them all at the /export endpoint, which requires massive database joins). Let's see your database handle that!` },
  { role: 'good', text: `Actually, the database is fine. My Circuit Breaker just tripped! It noticed the database was starting to slow down, so it immediately cut the connection. It sacrificed the /export endpoint and started returning 503 Service Unavailable to everyone, but it kept the rest of the application alive.` },
  { role: 'bad', text: `(Laughs) Wait... "to everyone"? So nobody can use /export now? I just successfully triggered a Denial of Service for your legitimate users! Your circuit breaker protected your database, but it didn't punish me.` },
  { role: 'good', text: `Yeah that's true... I know. Circuit breaking is a reactive shield, it stops cascading failures after the system is already hurting. But to stop you proactively, before the circuit breaker ever has to trip, I need to recognize that not all requests are the same.` },
  { role: 'good', text: `(Flips a switch) Introducing: Weighted/Cost-based Rate Limiting! I'll modify the config so a standard /ping costs 1 token, but your heavy /export query costs 50 tokens.` },
  { role: 'bad', text: `(Runs script) Damn it! Two heavy queries and I've already burned my whole 100-token budget — the third one gets a 429 Too Many Requests. And /export is still up for everyone else!` },
  { role: 'bad', text: `Hmm... I refuse to give up. Let me think, think, think...` },
  { role: 'bad', text: `(Pretends to run a script) First, the Sequential Test: If I send requests one by one, they get cut off at exactly the limit. Your math works perfectly.` },
  { role: 'bad', text: `But let's try a Burst Test. What if I fire 200 requests at the exact same millisecond using a highly concurrent script?` },
]
