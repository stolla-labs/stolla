# Seven-day community launch playbook

This playbook gives contributors and community operators a practical sequence
for launching a Stolla community. It focuses on member activation and healthy
governance participation. It does not predict token prices, trading activity,
or financial returns.

## Before day 1

- Confirm the creator wallet is connected to the intended Stellar network.
- Open `/community` and verify that the community creation flow is available.
- Review the launch-kit work in [issue #263](https://github.com/stolla-labs/stolla/issues/263)
  and the launch-template dependency in
  [issue #486](https://github.com/stolla-labs/stolla/issues/486). If either is
  not shipped, prepare the name, description, image, membership rules, and
  first proposal manually.
- Decide who will own launch support, membership questions, and proposal
  moderation during the first week.

## Day 1: create and verify the community

1. Create the community from `/community`.
2. Save the deployed community URL and contract identifiers shown by the app.
3. Open `/communities` and confirm that the new community is discoverable.
4. Complete the creator onboarding checklist tracked by
   [issue #400](https://github.com/stolla-labs/stolla/issues/400), or record the
   equivalent checks manually until that feature ships.

**Exit check:** another contributor can open the community detail page without
using the creator wallet.

## Day 2: prepare the membership claim path

1. Open the community detail page at `/communities/<community-id>`.
2. Publish the membership eligibility rules and the wallet/network members
   should use.
3. Use the self-claim flow from
   [issue #480](https://github.com/stolla-labs/stolla/issues/480) when available.
   Until then, use the existing owner mint flow and keep a reviewed list of
   recipient addresses.
4. Ask one test member to complete the flow before sharing it broadly.

**Exit check:** the test member can see their membership and understands what
the membership grants.

## Day 3: activate delegation

1. Direct members to the community detail page at
   `/communities/<community-id>`.
2. Explain that voting power must be delegated before it can be used.
3. Ask early members to delegate to themselves, then confirm the updated voting
   power in the UI.
4. Record common questions for the launch FAQ instead of relying on direct
   messages.

**Exit check:** at least one non-creator member has delegated voting power and
can describe the next governance step.

## Day 4: publish the first proposal

1. Draft a narrowly scoped proposal with a clear decision and voting window.
2. Create it from `/community/<community-id>/proposals` when using a scoped
   community route, or from `/proposals` for the default configured community.
3. Open the resulting proposal detail page and verify the title, description,
   deadline, and available vote actions.
4. Share the proposal URL with the launch group before announcing it publicly.

**Exit check:** a delegated test member can reach the proposal and understand
how to vote without creator assistance.

## Day 5: enable proposal alerts

1. Review the Discord alert integration tracked in
   [issue #482](https://github.com/stolla-labs/stolla/issues/482).
2. If it is available, configure alerts for new proposals and approaching vote
   deadlines. If not, assign a contributor to post the same notices manually.
3. Link every alert directly to the proposal detail page.
4. Avoid urgency language that implies guaranteed financial outcomes.

**Exit check:** the launch group receives one test notification containing a
working proposal link and deadline.

## Day 6: observe and unblock participation

1. Review `/activity` for recent proposal and vote activity.
2. Check `/proposals` for proposals with low participation or an approaching
   deadline.
3. Follow up with members who reported claim, wallet, delegation, or voting
   problems. Never request a seed phrase or private key.
4. Update the public FAQ with recurring questions and route people to the
   documented flow.

**Exit check:** known blockers have an owner, a workaround, or a linked issue.

## Day 7: close the first launch cycle

1. Review the first proposal outcome and participation pattern.
2. Publish a short recap with links to the community, proposal, and relevant
   activity. Report observed facts rather than price or growth promises.
3. Agree on the next proposal cadence and alert owner.
4. Start a second seven-day cycle only after recording what should change in
   the template, claim path, alerts, or onboarding checklist.

**Exit check:** contributors know the next governance date, where to find the
community, and how to report a blocker.

## Launch review checklist

- [ ] Community appears in `/communities` and its detail route loads.
- [ ] Membership rules and the claim or mint path are documented.
- [ ] A non-creator member has delegated voting power.
- [ ] The first proposal has a clear decision, deadline, and working link.
- [ ] Proposal alerts have been tested or have a named manual owner.
- [ ] `/activity` and `/proposals` were reviewed for participation blockers.
- [ ] Public copy avoids token-price, return, or adoption guarantees.
- [ ] Follow-up work links to its owning issue.

