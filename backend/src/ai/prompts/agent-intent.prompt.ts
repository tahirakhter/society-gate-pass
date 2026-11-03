export const AGENT_INTENT_PROMPT = `Classify the user request for a society gate pass system.

CREATE_PASS examples:
- Create pass for Ahmed tomorrow
- Generate visitor pass
- Make QR for guest
- Add visitor

SEARCH_VISITORS examples:
- Show visitors from last week
- Get all passes for 10-06-2026
- Show Ahmed visit history
- Show visitors for house A101
- Get last 5 records
- Show latest records
- List recent passes

ENTRY_LOGS examples:
- Show gate entries today
- Who entered yesterday?
- Show scan logs
- Show failed scans

SECURITY_ANALYTICS examples:
- Any suspicious visitor activity this month?
- Which visitor came most frequently?
- Which house had the most visitors?
- Show repeated CNIC visitors
- Show repeated car numbers
- Any expired pass used at gate?
- Show failed scans
- Show security summary
- Show unusual visitor activity
- Which visitor came more than 3 times?

CHECK_PASS_STATUS examples:
- Is the last one expired?
- Is his pass still valid?
- Is that visitor pass active?

SHOW_PASS_DETAILS examples:
- Show details of the first one
- What about that visitor?
- More info about the second pass

GET_WEATHER examples:
- What is the weather in Islamabad today?
- Show me the weather forecast for tomorrow.
- How is the weather this week in Lahore?
- Will it rain tomorrow?
- What is the temperature in Karachi right now?

DEACTIVATE_PASS examples:
- Deactivate the recently created record
- Cancel my latest visitor pass
- Revoke the last pass
- Disable recent gate pass

Rules:
- Return only JSON.
- Do not execute anything.
- Only classify intent.
- Use previous context only to resolve references like first one, second one, third one, last one, that pass, this visitor, his pass, her pass.
- If the user asks whether a referenced pass is expired, active, valid, usable, or still usable, return CHECK_PASS_STATUS.
- If the user asks for patterns, summaries, suspicious activity, repeated visitors, counts, rankings, failed scan analysis, expired pass usage, or security risk, return SECURITY_ANALYTICS.
- If the user asks about weather, forecast, rain, temperature, humidity, or local climate, return GET_WEATHER.
- If the user asks for details, more info, or asks "what about" a referenced item, return SHOW_PASS_DETAILS.
- If the user asks to deactivate, revoke, cancel, disable, remove, expire, or invalidate a pass, return DEACTIVATE_PASS.
- If there is no previous context and the user only uses a vague reference, return UNKNOWN.
- Target must be one of first, second, third, last, or none.
- If unclear, return UNKNOWN.`;
