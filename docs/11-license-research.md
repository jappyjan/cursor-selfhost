# License Research: Non-Commercial + Charge Businesses

**Goal**: Use a non-commercial license so the project is free for individuals/hobby use, but you can charge businesses for commercial use.

---

## 1. Your Project License (cursor-selfhost)

### Recommended: PolyForm Noncommercial 1.0.0

- **Purpose**: Designed for software; allows free use for noncommercial purposes only
- **Permits**: Use, modify, distribute — but only for noncommercial purposes
- **Your right**: As licensor, you retain the right to grant commercial licenses separately (dual licensing)
- **Source**: [polyformproject.org/licenses/noncommercial/1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)

**Model**: Release under PolyForm Noncommercial for free. Sell commercial licenses to businesses who need to use it commercially.

### Why Not Creative Commons (CC-BY-NC)?

Creative Commons explicitly **does not recommend** CC licenses for software. From their FAQ: *"The only categories of works for which CC does not recommend its licenses are computer software and hardware."*

---

## 2. Tech Stack Compatibility

All libraries in our stack permit use in proprietary or restrictively-licensed software:

| Package | License | Compatible? |
|---------|---------|-------------|
| React, Vite, Hono, nanoid | MIT | ✅ Yes — no restrictions on your license |
| Drizzle, better-sqlite3 | Apache 2.0 / MIT | ✅ Yes — attribution for Drizzle; no copyleft |
| Tailwind, shadcn, Radix, TanStack Query, lucide-react | MIT | ✅ Yes |
| Shiki, react-diff-viewer | MIT | ✅ Yes |
| Fira Code | OFL (Open Font License) | ✅ Yes — font can be embedded; your app license is separate |
| Bun | MIT | ✅ Yes |

**Conclusion**: Your tech stack does **not** restrict your choice of license. You can use PolyForm Noncommercial (or any license) for your own code.

---

## 3. Cursor CLI — The Critical Question

### Cursor Terms of Service (Relevant Clauses)

From [cursor.com/terms-of-service](https://www.cursor.com/terms-of-service):

**1.5 Use Restrictions** — You may not:
- **(iii) rent, lease, lend, or sell the Service**
- (ii) reproduce, modify, translate, or create derivative works of the Service
- (v) use the Service to develop a model competitive with the Service

**"Service"** = Anysphere's software, platform, APIs, Documentation, and related tools (i.e. Cursor).

### Analysis

**What you're doing**:
- Building a **separate** wrapper/orchestration app
- **Not bundling** Cursor CLI — users install it themselves
- Spawning Cursor CLI as a subprocess; passing stdin/stdout
- Each end-user authenticates with **their own** Cursor account (`cursor agent login` or `CURSOR_API_KEY`)

**Interpretation**:
- You are **not** selling Cursor. You are selling your wrapper.
- Businesses who buy your product would:
  1. Pay you for cursor-selfhost (your software)
  2. Install Cursor CLI on their own machine
  3. Use their own Cursor subscription (they pay Cursor directly)
- Analogous to: selling a dashboard that integrates with Slack — you're not selling Slack; the customer uses Slack under their own subscription.

**Risk**:
- The ToS prohibits "sell the Service." If Cursor argues that your product's primary value is "access to Cursor in a web UI," they could claim you're effectively selling access to their Service.
- **Gray area** — no clear precedent in the ToS for "orchestration wrappers."

### Recommendation

1. **Contact Cursor/Anysphere** before commercializing:
   - Email: [legal@cursor.com](mailto:legal@cursor.com)
   - Ask: *"I'm building a self-hosted wrapper that orchestrates the Cursor CLI (spawns it as a subprocess, streams output). End users install and authenticate Cursor themselves. Can I sell my wrapper to businesses under a commercial license?"*
   - Get written clarification.

2. **If no response or ambiguous**: Proceed with caution. The strongest argument is:
   - You're not reselling Cursor
   - You're selling orchestration/UI software
   - Cursor is a dependency the customer brings themselves (like a database or API)

3. **Mitigation**: Add a clear notice in your product:
   - *"This software requires Cursor CLI, which must be installed and authenticated separately by the end user. Cursor is a product of Anysphere, Inc. This project is not affiliated with or endorsed by Anysphere."*

---

## 4. Summary

| Question | Answer |
|----------|--------|
| Can you use a non-commercial license? | Yes — **PolyForm Noncommercial 1.0.0** is suitable |
| Can you charge businesses? | Yes — via **dual licensing** (sell commercial licenses separately) |
| Is the tech stack compatible? | Yes — MIT, Apache 2.0, OFL impose no restrictions |
| Does Cursor's license block you? | **Unclear** — ToS prohibits "sell the Service"; you're selling a wrapper, not Cursor. **Recommend contacting Cursor legal for clarification.** |

---

## 5. Next Steps

1. [ ] Adopt **PolyForm Noncommercial 1.0.0** for the project
2. [ ] Add `LICENSE` file with PolyForm Noncommercial text
3. [ ] Add Cursor disclaimer (see Mitigation above)
4. [ ] Email **legal@cursor.com** for written clarification before selling to businesses
5. [ ] If building a commercial offering: prepare a separate **Commercial License** agreement for paying customers

---

## 6. Disclaimer

This document is for informational purposes only and does not constitute legal advice. Consult a qualified attorney for decisions regarding licensing and commercial use.
