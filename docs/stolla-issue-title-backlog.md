# Stolla Issue Title Backlog

This backlog turns the findings in [Stolla MVP Assessment and Recommended Roadmap](stolla-mvp-assessment.md) into 125 small, independently reviewable GitHub issue candidates.

The titles are ordered by the recommended delivery sequence. Linked items already exist on GitHub. Unlinked titles are planning candidates and must be checked for overlap again before creation.

Future issue bodies should include the problem, scope, out-of-scope items, acceptance criteria, dependencies, and verification steps. Time estimates will be omitted.

## Workstream 1 — Existing starter issues

1. [Fix mobile header layout and horizontal page overflow](https://github.com/stolla-labs/stolla/issues/2) — existing issue #2
2. [Label static landing-page proposal content as demo data](https://github.com/stolla-labs/stolla/issues/3) — existing issue #3
3. [Add loading skeletons to community and proposal pages](https://github.com/stolla-labs/stolla/issues/4) — existing issue #4
4. [Add a contributor guide and pull request template](https://github.com/stolla-labs/stolla/issues/5) — existing issue #5

## Workstream 2 — Quality gates and development reliability

5. [Exclude generated Soroban bindings from frontend linting](https://github.com/stolla-labs/stolla/issues/12) — existing issue #12
6. [Refactor community data loading to satisfy React effect lint rules](https://github.com/stolla-labs/stolla/issues/11) — existing issue #11
7. [Refactor proposal list loading to satisfy React effect lint rules](https://github.com/stolla-labs/stolla/issues/8) — existing issue #8
8. [Refactor proposal detail loading to satisfy React effect lint rules](https://github.com/stolla-labs/stolla/issues/7) — existing issue #7
9. [Add a dedicated frontend TypeScript type-check command](https://github.com/stolla-labs/stolla/issues/10) — existing issue #10
10. [Align frontend CI installation and caching with the root lockfile](https://github.com/stolla-labs/stolla/issues/6) — existing issue #6
11. [Run workspace layout validation in CI](https://github.com/stolla-labs/stolla/issues/9) — existing issue #9
12. [Add frontend linting as a required CI check](https://github.com/stolla-labs/stolla/issues/14) — existing issue #14
13. [Add frontend type-checking as a required CI check](https://github.com/stolla-labs/stolla/issues/13) — existing issue #13
14. [Set up Vitest and React Testing Library for the web workspace](https://github.com/stolla-labs/stolla/issues/15) — existing issue #15
15. [Add reusable Stellar RPC and contract test mocks](https://github.com/stolla-labs/stolla/issues/22) — existing issue #22
16. [Set up Playwright with a mobile navigation smoke test](https://github.com/stolla-labs/stolla/issues/19) — existing issue #19
17. [Add a repeatable development-server startup smoke script](https://github.com/stolla-labs/stolla/issues/20) — existing issue #20
18. [Add a clean command for resetting Next.js and Turbopack caches](https://github.com/stolla-labs/stolla/issues/16) — existing issue #16
19. [Add a deployment health endpoint with configuration checks](https://github.com/stolla-labs/stolla/issues/18) — existing issue #18
20. [Add a scheduled production health-check workflow](https://github.com/stolla-labs/stolla/issues/25) — existing issue #25

## Workstream 3 — Mobile UX, accessibility, and error states

21. [Add a compact connected-wallet menu to the mobile app header](https://github.com/stolla-labs/stolla/issues/23) — existing issue #23
22. [Prevent long wallet addresses and proposal IDs from causing horizontal overflow](https://github.com/stolla-labs/stolla/issues/21) — existing issue #21
23. [Make the community mint form usable at 320px viewport width](https://github.com/stolla-labs/stolla/issues/17) — existing issue #17
24. [Make the proposal creation form usable at 320px viewport width](https://github.com/stolla-labs/stolla/issues/24) — existing issue #24
25. [Make vote actions full-width controls on mobile](https://github.com/stolla-labs/stolla/issues/32) — existing issue #32
26. [Add a skip link and main landmarks to app layouts](https://github.com/stolla-labs/stolla/issues/33) — existing issue #33
27. [Add accessible labels and help text to governance form controls](https://github.com/stolla-labs/stolla/issues/34) — existing issue #34
28. [Announce wallet and transaction status changes with ARIA live regions](https://github.com/stolla-labs/stolla/issues/30) — existing issue #30
29. [Add consistent focus-visible styles to app navigation and action controls](https://github.com/stolla-labs/stolla/issues/27) — existing issue #27
30. [Add a retryable RPC error state to the community page](https://github.com/stolla-labs/stolla/issues/35) — existing issue #35
31. [Add a retryable RPC error state to the proposal list](https://github.com/stolla-labs/stolla/issues/28) — existing issue #28
32. [Handle malformed and unknown proposal IDs on the detail page](https://github.com/stolla-labs/stolla/issues/26) — existing issue #26
33. [Surface wallet connection failures in the app UI](https://github.com/stolla-labs/stolla/issues/29) — existing issue #29

## Workstream 4 — Public proposal discovery and governance visibility

34. [Write an ADR for RPC event-based proposal discovery and indexer escalation](https://github.com/stolla-labs/stolla/issues/31) — existing issue #31
35. [Inventory the Governor proposal and vote event surface](https://github.com/stolla-labs/stolla/issues/36) — existing issue #36
36. [Add a regression test for proposal creation events](https://github.com/stolla-labs/stolla/issues/38) — existing issue #38
37. [Define and test a typed proposal event decoder](https://github.com/stolla-labs/stolla/issues/39) — existing issue #39
38. [Add a testnet RPC client for querying Governor events](https://github.com/stolla-labs/stolla/issues/37) — existing issue #37
39. [Add a configurable start ledger for proposal discovery](https://github.com/stolla-labs/stolla/issues/40) — existing issue #40
40. [Add pagination support to Governor event queries](https://github.com/stolla-labs/stolla/issues/42) — existing issue #42
41. [Deduplicate proposal events across paginated RPC responses](https://github.com/stolla-labs/stolla/issues/43) — existing issue #43
42. [Normalize proposal events into a shared proposal summary model](https://github.com/stolla-labs/stolla/issues/41) — existing issue #41
43. [Add a public proposal discovery hook for the web app](https://github.com/stolla-labs/stolla/issues/44) — existing issue #44
44. [Replace localStorage proposal discovery with the public data source](https://github.com/stolla-labs/stolla/issues/45) — existing issue #45
45. [Preserve locally created proposal IDs during the discovery migration](https://github.com/stolla-labs/stolla/issues/54) — existing issue #54
46. [Replace “Your proposals” with public governance history copy](https://github.com/stolla-labs/stolla/issues/46) — existing issue #46
47. [Show per-proposal state lookup failures without hiding the proposal list](https://github.com/stolla-labs/stolla/issues/49) — existing issue #49
48. [Add a load-more control to the public proposal history](https://github.com/stolla-labs/stolla/issues/55) — existing issue #55
49. [Add proposal-state filters to the proposal history](https://github.com/stolla-labs/stolla/issues/48) — existing issue #48
50. [Extract a reusable proposal summary card component](https://github.com/stolla-labs/stolla/issues/51) — existing issue #51
51. [Show proposal descriptions on proposal list cards](https://github.com/stolla-labs/stolla/issues/50) — existing issue #50
52. [Show the proposer as a shortened copyable address](https://github.com/stolla-labs/stolla/issues/53) — existing issue #53
53. [Show proposal snapshot and deadline ledger numbers](https://github.com/stolla-labs/stolla/issues/47) — existing issue #47
54. [Show vote totals and quorum progress on proposal details](https://github.com/stolla-labs/stolla/issues/52) — existing issue #52

## Workstream 5 — Wallet, transaction lifecycle, and frontend coverage

55. [Show the connected wallet’s voting power on proposal details](https://github.com/stolla-labs/stolla/issues/56) — existing issue #56
56. [Build a reusable transaction lifecycle status component](https://github.com/stolla-labs/stolla/issues/57) — existing issue #57
57. [Show simulation and wallet approval stages for NFT minting](https://github.com/stolla-labs/stolla/issues/64) — existing issue #64
58. [Show submission and confirmation stages for NFT delegation](https://github.com/stolla-labs/stolla/issues/58) — existing issue #58
59. [Show the full transaction lifecycle for proposal creation](https://github.com/stolla-labs/stolla/issues/65) — existing issue #65
60. [Show the full transaction lifecycle for vote submission](https://github.com/stolla-labs/stolla/issues/62) — existing issue #62
61. [Map wallet rejection, RPC, and contract failures to actionable messages](https://github.com/stolla-labs/stolla/issues/61) — existing issue #61
62. [Add Stellar explorer links to successful transaction confirmations](https://github.com/stolla-labs/stolla/issues/59) — existing issue #59
63. [Prevent duplicate submissions while a transaction is pending](https://github.com/stolla-labs/stolla/issues/60) — existing issue #60
64. [Test wallet connection, disconnection, and failure states](https://github.com/stolla-labs/stolla/issues/63) — existing issue #63
65. [Test community page loading and RPC failure states](https://github.com/stolla-labs/stolla/issues/68) — existing issue #68
66. [Test mint form validation and submission errors](https://github.com/stolla-labs/stolla/issues/67) — existing issue #67
67. [Test delegation success and failure states](https://github.com/stolla-labs/stolla/issues/72) — existing issue #72
68. [Test proposal list empty, populated, and partial-failure states](https://github.com/stolla-labs/stolla/issues/66) — existing issue #66
69. [Test proposal creation validation and submission errors](https://github.com/stolla-labs/stolla/issues/70) — existing issue #70
70. [Test proposal detail loading and vote submission states](https://github.com/stolla-labs/stolla/issues/69) — existing issue #69

## Workstream 6 — Contract tests and governance hardening

71. [Create reusable multi-voter Governor test fixtures](https://github.com/stolla-labs/stolla/issues/71) — existing issue #71
72. [Test proposal threshold behavior at and below the boundary](https://github.com/stolla-labs/stolla/issues/74) — existing issue #74
73. [Test the Pending-to-Active transition at the voting-delay boundary](https://github.com/stolla-labs/stolla/issues/75) — existing issue #75
74. [Test Active-state closure at the voting-period boundary](https://github.com/stolla-labs/stolla/issues/73) — existing issue #73
75. [Test duplicate vote rejection without tally mutation](https://github.com/stolla-labs/stolla/issues/82) — existing issue #82
76. [Test For, Against, and Abstain tally accounting with weighted voters](https://github.com/stolla-labs/stolla/issues/76) — existing issue #76
77. [Test quorum outcomes at and below the exact boundary](https://github.com/stolla-labs/stolla/issues/78) — existing issue #78
78. [Test proposal snapshot immunity to later voting-power changes](https://github.com/stolla-labs/stolla/issues/83) — existing issue #83
79. [Test proposer-only cancellation and unauthorized operator rejection](https://github.com/stolla-labs/stolla/issues/79) — existing issue #79
80. [Test successful proposal execution against a fixture contract](https://github.com/stolla-labs/stolla/issues/77) — existing issue #77
81. [Test invalid and repeated proposal execution failures](https://github.com/stolla-labs/stolla/issues/85) — existing issue #85
82. [Replace broad auth mocking with exact owner mint authorization assertions](https://github.com/stolla-labs/stolla/issues/84) — existing issue #84
83. [Test sequential token ID uniqueness across multiple mints](https://github.com/stolla-labs/stolla/issues/80) — existing issue #80
84. [Test voting-power updates across NFT transfers and redelegation](https://github.com/stolla-labs/stolla/issues/81) — existing issue #81
85. [Add a property test for delegated voting-power conservation](https://github.com/stolla-labs/stolla/issues/86) — existing issue #86

## Workstream 7 — Security, multi-community, and mainnet readiness

86. [Define and enforce validation for empty NFT token URIs](https://github.com/stolla-labs/stolla/issues/87) — existing issue #87
87. [Test that custom token URIs survive NFT ownership transfers](https://github.com/stolla-labs/stolla/issues/88) — existing issue #88
88. [Add contract storage and TTL advancement regression tests](https://github.com/stolla-labs/stolla/issues/89) — existing issue #89
89. [Analyze browser-reachable dependency vulnerabilities and publish an upgrade plan](https://github.com/stolla-labs/stolla/issues/90) — existing issue #90
90. [Write a CommunityFactory and registry architecture decision record](https://github.com/stolla-labs/stolla/issues/91) — existing issue #91
91. [Scaffold the CommunityFactory contract registration interface](https://github.com/stolla-labs/stolla/issues/92) — existing issue #92
92. [Add community registry storage with list and get operations](https://github.com/stolla-labs/stolla/issues/93) — existing issue #93
93. [Test factory deployment of paired NFT and Governor contracts](https://github.com/stolla-labs/stolla/issues/94) — existing issue #94
94. [Define the community metadata and governance parameter schema](https://github.com/stolla-labs/stolla/issues/95) — existing issue #95
95. [Add the public communities list route](https://github.com/stolla-labs/stolla/issues/96) — existing issue #96
96. [Add the community detail route](https://github.com/stolla-labs/stolla/issues/97) — existing issue #97
97. [Build the first step of the community creation wizard](https://github.com/stolla-labs/stolla/issues/98) — existing issue #98
98. [Design community-scoped proposal discovery and indexing](https://github.com/stolla-labs/stolla/issues/99) — existing issue #99
99. [Write a timelock and treasury execution architecture decision record](https://github.com/stolla-labs/stolla/issues/100) — existing issue #100
100. [Draft the testnet-to-mainnet deployment and monitoring runbook](https://github.com/stolla-labs/stolla/issues/101) — existing issue #101

## Workstream 8 — Community creation completion

101. [Build the governance parameters step of the community creation wizard](https://github.com/stolla-labs/stolla/issues/125) — existing issue #125
102. [Add a review and deployment summary step to the community creation wizard](https://github.com/stolla-labs/stolla/issues/126) — existing issue #126
103. [Connect the community creation wizard to CommunityFactory deployment](https://github.com/stolla-labs/stolla/issues/127) — existing issue #127
104. [Show recoverable progress for paired community contract deployment](https://github.com/stolla-labs/stolla/issues/128) — existing issue #128
105. [Add a registry-verified community creation success screen](https://github.com/stolla-labs/stolla/issues/129) — existing issue #129

## Workstream 9 — Multi-community discovery and navigation

106. [Add name search to the public communities list](https://github.com/stolla-labs/stolla/issues/132) — existing issue #132
107. [Preserve community list pagination and filters in the URL](https://github.com/stolla-labs/stolla/issues/133) — existing issue #133
108. [Add resilient logo and metadata fallbacks to community cards](https://github.com/stolla-labs/stolla/issues/134) — existing issue #134
109. [Add share and copy actions to community details](https://github.com/stolla-labs/stolla/issues/135) — existing issue #135
110. [Add a community switcher to app navigation](https://github.com/stolla-labs/stolla/issues/136) — existing issue #136
111. [Add a community-scoped proposal history route](https://github.com/stolla-labs/stolla/issues/137) — existing issue #137
112. [Add a community-scoped proposal detail route](https://github.com/stolla-labs/stolla/issues/138) — existing issue #138
113. [Scope mint and delegation actions to the selected community](https://github.com/stolla-labs/stolla/issues/139) — existing issue #139
114. [Add Create community entry points to landing and communities pages](https://github.com/stolla-labs/stolla/issues/140) — existing issue #140

## Workstream 10 — Wizard resilience and multi-community testing

115. [Warn before leaving the community creation wizard with unsaved changes](https://github.com/stolla-labs/stolla/issues/141) — existing issue #141
116. [Persist community creation drafts in session storage](https://github.com/stolla-labs/stolla/issues/142) — existing issue #142
117. [Add explicit discard and restart controls to the community creation wizard](https://github.com/stolla-labs/stolla/issues/143) — existing issue #143
118. [Show simulated resource fees before community deployment approval](https://github.com/stolla-labs/stolla/issues/144) — existing issue #144
119. [Handle wallet account changes during community creation](https://github.com/stolla-labs/stolla/issues/145) — existing issue #145
120. [Handle wallet network changes during community creation](https://github.com/stolla-labs/stolla/issues/146) — existing issue #146
121. [Rebuild expired community deployment transactions safely](https://github.com/stolla-labs/stolla/issues/147) — existing issue #147
122. [Test community list search, pagination, and metadata failure states](https://github.com/stolla-labs/stolla/issues/148) — existing issue #148
123. [Test community detail and scoped proposal navigation states](https://github.com/stolla-labs/stolla/issues/149) — existing issue #149
124. [Add a Playwright multi-community public browsing flow](https://github.com/stolla-labs/stolla/issues/150) — existing issue #150
125. [Add a Playwright community creation flow with mocked wallet and RPC](https://github.com/stolla-labs/stolla/issues/151) — existing issue #151

## Suggested dependency order

- Complete backlog items 5–8 before enabling the lint gate in item 12.
- Complete backlog item 9 before enabling the type-check gate in item 13.
- Complete backlog items 14 and 15 before adding the frontend tests in items 64–70.
- Complete the existing responsive header issue #2 before backlog items 21–25 and the Playwright mobile smoke test in item 16.
- Complete backlog items 34–43 before replacing local proposal storage in item 44.
- Complete public discovery in backlog item 44 before public-history UI work in items 46–54.
- Complete the shared lifecycle component in backlog item 56 before integrating transaction stages in items 57–60.
- Complete the multi-voter fixture in backlog item 71 before the Governor boundary and lifecycle tests in items 72–81.
- Complete the CommunityFactory ADR in backlog item 90 before contract implementation work in items 91–94.
- Complete the community data model and registry work in backlog items 92–94 before routes and wizard work in items 95–98.
- Complete the metadata step in backlog item 97 before the remaining wizard flow in items 101–105.
- Complete the base community routes in items 95–96 before discovery and scoped-navigation work in items 106–114.
- Complete the creation flow in items 101–105 before resilience and end-to-end coverage in items 115–125.
