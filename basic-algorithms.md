Rate limiting is there to answer 1 simple question:
Should this request be allowed, or not?

There are differnet ways to achieve it, and each have different trade-offs:
- accuracy: Do you care it to be exactly that amount? (e.g. selling items on a market place/tickets, you definitely should care.)
- cost: Accuracy might require more memory and CPU usage to store identity info (e.g. user, API key, IP)... which matter a lot when you're dealing with millions of requests.
- burst behavior: Can you handle short spikes  above sustained rate (do you wanna absorb, reject or queue/smooth them)?

There isn't one algorithm that solves all 3. That's why there are multiple of them.

Fixed Window Counter
-------------------------
You divide time into fixed intervals. E.g. 1 minute boxes. You keep a counter per key, per window.
Each request increments the counter, and if limit exceeds, it rejects. 
When window rolls over, the limit resets.
+ very simple to implement. 
+ O(1) memory and CPU, very cheap at any scale.
+ Easy to explain
+ Resets are predictable, so debugging is easy too
- Prone to spikes at boundary, 2x than expected load
- Encourages thundering herds - if clients are relying on X-retry-at header and backing off, everyone will retry exactly
at that moment
- no burst allowance 
Okay for e.g. login attempts, not good for protecting backend capacity.

Sliding Window Log
-------------------------
[timestamp][key] stored per request
On each new request, evict entry which has [timestamp] older than the window, count what remains, and decide allow/reject.
Because window follows wall clock, enforcement isexact.
+ perfectly accurate
+because log is record of recent requests, helps solving disputes "you rate limited me unfairly".
- O(N) memory per key (N-> number of requests), so this is not good for large volume. Like, the cost is scaling together
with the volume it's handling.
- Also extra eviction work on every request, limiter itself is the hotspot then
- If you are using redis, it's typically multiple operations and sorting involved (ZADD+ZREMRANGEBYSCORE+ZCARD)
Use only when exactness is hard requirement and per-key volume is low. (e.g. export operation with 5 req/h)
Rarely the right answer for high-throughput API limiting.


Sliding Window Counter
-----------------------
It's a hybrid.
You use a fixed-window counter, but you estimate sliding0window count by weighting previous window's counter by its overlap 
with the sliding window. 

E.g. If current window is 40% elapsed, estimated count = current count + 0.6 x previous counter. 
If this estimate is under the limit, then admit.

+ Good balance between accuracy and cost: Two counters and a timestamp per key, O(1) everything
+ Eliminates 2x boundary problem 
+ Smooths the thundering herd at reset behavior of fixed widows a little
- It's an estimate. Weighting assumes requests in previous window were uniformly distribted, but this is not true for
bursty traffic. So we can end up over-or-under admit at margins.
- Much harder to explain to consumers, because behavior near the limit is fuzzy.
- No explicit burst allowance 

Best for high-scale requests when burst tolerance is not a requirement (or when downstream really can't handle it)

Token Bucket 
----------------
You have a bucket that has a max capacity M,
and you have a refill rate that fills at R/second.
Each new request consumes a token (or multiple if you are using weighted rate limiting!)
When request comes, you check the bucket.
If there are enough tokens, great, allow.
If there are not - reject.
Tokens count is lazy, as we compute bucket state at request time, so we don't have background work.

+ Burst tolerance. You can spend all your tokens at a burst, no problem
+ O(1) memory per key. <==== ??? what does it store as key????
+ Easy for weighted costs. LLM gateways tend to use it for model-token-based costing
+ Easy to explain "100 req/s sustained, but you can burst up to 500 req/s" --> means bucket size is 500 and refills at rate 1 every 10 ms (100 per second)
+ Wide support (guava ratelimiter, envoy, kong, cloud API gateways... tend to have it by default)
- If backend was sized for sustained traffic, the burst traffic can bring it down
- Not easy to manage distributed state with a centralized source of truth (network hop, critical dependency), when there
is shard per node it can break under uneven load balancing. It's a non-atomic read-modify-write with shared buckets, 
you can easily overadmit
- Fresh keys start with full buckets, so if you are rotating keys/IPs you can easily exploit this.
It's a good default for general-purpose API rate limiting when clients are bursty and you are attempting to protect
against sustained overuse rather than lil bursts.

Leaky Bucket
-----------------
Requests are queued in a bucket with fixed capacity;
the queue drains at a constant rate.
Any new request overflowing from bucket is rejected.
Output is a constant stream of requests, regardless of how bursty the traffic is.

+ constant rate output; backend knows what to expect, no unexpected spikes
+ tolerates bursts short-term; just processes them at a steady rate
- latency. recent requests wait in the queue, and reality might be already stale by the time your request is processed 
(e.g. you were buying the last seat at a concert but by the time your request was processed, it was already gone)
- punishes legitimate bursty traffic

Use when your backend needs steady state requests handling. 




