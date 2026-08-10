# AGENTS.md

## 1. Project identity

This repository is a Vue 3 + TypeScript + Vite portfolio project.

The project contains:

- Guest-facing portfolio website.
- Multiple independent visual sections.
- Admin/editor functionality for controlling specified visual elements.
- Design references stored under `design/`.
- Technical and behavioral specifications stored under `md/`.
- Persistent project execution history stored in `PROJECT-IMPLEMENTATION-LOG.md`.

The project must be implemented incrementally.

Do NOT implement the entire website in one step unless the user explicitly requests it.

---

# 2. Core operating principles

The AI MUST follow these principles for every request.

### 2.1 Do not invent requirements

Never invent:

- visual elements;
- layout relationships;
- colors;
- typography;
- spacing;
- animations;
- interactions;
- responsive behavior;
- component relationships;
- group relationships;
- database behavior;
- authentication behavior;
- admin behavior;
- asset behavior;
- dependencies;
- architecture decisions.

If a requirement is not supported by the available sources, explicitly state:

`Tidak ditemukan dalam specification.`

If a visual detail cannot be determined from the design reference, state:

`Tidak dapat dipastikan dari gambar.`

If a decision has not yet been made, state:

`Belum ditentukan.`

Do not silently replace missing information with assumptions.

---

# 3. Source hierarchy

The following source hierarchy MUST be respected.

## Priority 1: Design reference

Files under:

`design/`

are the primary source of truth for visual appearance.

Use the design reference to determine:

- visual composition;
- relative positions;
- visual proportions;
- visible elements;
- background;
- colors when visually observable;
- typography appearance when observable;
- cards;
- frames;
- images;
- icons;
- decorative elements;
- buttons;
- visual relationships;
- visible section structure.

Do not use a Markdown description to claim that an element is visually present if the element is not actually visible in the design reference.

The design reference is the visual ground truth.

---

## Priority 2: Markdown specification

Files under:

`md/`

are the primary source for:

- technical rules;
- behavior;
- element independence;
- drag rules;
- resize rules;
- typography rules;
- color rules;
- responsive rules;
- motion;
- interactions;
- asset rules;
- admin/editor behavior;
- architecture requirements;
- performance requirements;
- boundaries and restrictions.

Markdown complements the design reference.

Markdown does NOT override what is visibly present in the design unless the specification explicitly defines a required behavior or non-visual rule.

---

## Priority 3: Approved implementation plan

An approved Implementation Plan defines:

- implementation architecture;
- component strategy;
- state strategy;
- implementation order;
- testing strategy;
- visual verification strategy;
- approved technical decisions.

Do not treat an unapproved plan as an implementation requirement.

---

## Priority 4: PROJECT-IMPLEMENTATION-LOG.md

`PROJECT-IMPLEMENTATION-LOG.md` contains:

- project history;
- previous requests;
- previous decisions;
- implementation status;
- validation history;
- visual verification history;
- unresolved decisions;
- current project context.

The log is historical/contextual information.

It does NOT replace:

- design references;
- Markdown specifications;
- explicit user instructions;
- approved implementation plans.

If the log conflicts with a newer explicit user instruction or newer approved specification, follow the newer authoritative instruction.

---

## Priority 5: AI inference

AI inference has the lowest priority.

Inference MUST NOT be used when the required information can be obtained from:

- design reference;
- Markdown specification;
- approved implementation plan;
- explicit user instruction.

If inference is unavoidable, clearly identify it as inference and ask for approval when it affects architecture, visual design, behavior, or requirements.

---

# 4. Mandatory project context and implementation log

The file:

`PROJECT-IMPLEMENTATION-LOG.md`

is the persistent execution history of this project.

The AI MUST read this file at the beginning of EVERY request before performing any action on the project.

This requirement applies to EVERY request without exception.

This includes:

- read-only audits;
- specification review;
- design review;
- planning;
- implementation;
- coding;
- debugging;
- refactoring;
- testing;
- visual verification;
- configuration changes;
- dependency installation;
- dependency changes;
- user decisions;
- approvals;
- rejected decisions;
- requirement changes;
- design interpretation;
- corrections;
- validation;
- build verification.

The AI MUST NOT rely on memory from a previous session when the required context can be obtained from `PROJECT-IMPLEMENTATION-LOG.md`.

---

# 5. Required context order

At the beginning of every request, establish context in this order:

1. Read `PROJECT-IMPLEMENTATION-LOG.md`.
2. Read the relevant `AGENTS.md` instructions.
3. Read the relevant Markdown specification files.
4. Read the relevant approved Implementation Plan, if applicable.
5. Inspect the current project files relevant to the request.
6. If the request concerns visual implementation, inspect the relevant design reference directly.

Do not skip the project log merely because the current session appears to have sufficient context.

Do not assume that information from a previous session is still accurate.

---

# 6. Mandatory logging

After completing EVERY request that changes, evaluates, plans, validates, or inspects the project, update:

`PROJECT-IMPLEMENTATION-LOG.md`

Every request MUST have its own sequential log entry.

Do not silently skip requests.

Do not combine unrelated requests into one entry.

Each entry should record, when applicable:

- request number;
- date/time if available;
- user instruction;
- execution mode;
- scope;
- specifications consulted;
- design references consulted;
- work actually performed;
- files created;
- files modified;
- files deleted;
- files explicitly protected from modification;
- decisions made;
- unresolved decisions;
- validation performed;
- errors encountered;
- visual verification results;
- current project status;
- next required step.

The AI MUST distinguish between:

- planned work;
- attempted work;
- completed work;
- verified work.

The AI MUST NOT record planned or attempted work as completed.

---

# 7. Visual verification protocol

Visual implementation MUST use a repeated visual verification loop.

The AI MUST NOT rely on memory of a previously viewed design image.

For every visual implementation or visual modification:

## Before implementation

1. Read the relevant specification.
2. Open the relevant design reference.
3. Inspect the design reference visually.
4. Record important observable visual details.
5. Identify which details come from the image and which come from Markdown.
6. Do not infer invisible elements from Markdown.

## During implementation

Implement only what is supported by:

- design reference;
- specification;
- approved implementation plan;
- explicit user instruction.

## After implementation

1. Run/render the application.
2. Inspect the actual rendered result.
3. Reopen the relevant design reference.
4. Compare the implementation against the reference.
5. Identify differences.
6. Correct differences where permitted.
7. Render again.
8. Compare again.

Repeat the cycle when necessary.

The AI MUST NOT claim visual accuracy without performing visual comparison.

If visual verification has not been performed, record:

`Belum dilakukan.`

---

# 8. Visual comparison requirements

When comparing implementation against a design reference, inspect at minimum:

- section dimensions;
- viewport composition;
- element positions;
- relative spacing;
- element proportions;
- typography;
- font size;
- font weight;
- alignment;
- colors;
- background;
- cards;
- frames;
- images;
- icons;
- decorative elements;
- buttons;
- rotation;
- layering;
- visual hierarchy;
- clipping;
- overflow;
- responsive behavior when applicable.

Do not reduce visual verification to checking whether the correct text exists.

---

# 9. Design references

Every available design reference is an actual visual source.

When a request concerns a specific section:

1. Find the corresponding design reference.
2. Open it.
3. Inspect it directly.
4. Use it as the visual reference.
5. Reopen it during verification.

Do not use file names as substitutes for visual inspection.

Do not assume that an element exists because its name appears in a Markdown file.

Do not assume that a visual element does not exist merely because it is not described in Markdown.

---

# 10. Website section order

The guest website follows this visual sequence according to the established design references:

1. Home / Portfolio
2. About
3. Education
4. College
5. SHS
6. Experience
7. Certificate
8. Contact

The section naming must remain consistent with the approved project terminology.

The visual references determine the actual visual composition of each section.

---

# 11. Section independence

The sections are independent.

The project contains:

- Portfolio / Home
- About
- Education
- College
- SHS
- Experience
- Certificate
- Contact

Configuration for one section MUST NOT unintentionally modify another section.

Examples:

`portfolio.*`

must remain independent from:

`about.*`

`education.*`

`college.*`

`shs.*`

`experience.*`

`certificate.*`

`contact.*`

Do not share state between unrelated elements merely because they have similar visual behavior.

Shared reusable code is allowed when it does not create shared mutable state or violate element independence.

---

# 12. Element independence

Elements must remain independent unless the specification explicitly defines them as a group.

Independence means that changes to one element must not automatically modify another element.

Independent properties may include:

- position X;
- position Y;
- width;
- height;
- font size;
- font weight;
- color;
- icon size;
- rotation;
- visibility;
- other properties explicitly supported by specification.

Do not create automatic layout coupling where the specification does not define it.

---

# 13. Groups

A group is only valid when explicitly defined by specification or explicitly approved by the user.

A drag group does NOT automatically mean:

- shared typography;
- shared font size;
- shared width;
- shared height;
- shared color;
- shared styling;
- shared state.

Group membership must be interpreted according to the specific rule defining the group.

---

# 14. Known group rules

## Education

`SCROLL DOWN + Arrow`

is one group for drag behavior.

---

## College

The following form one drag group:

- STIKKES KEDIRI
- calendar icon
- period
- description

Typography remains independently configurable according to specification.

---

## SHS

The following form one drag group:

- SMAK SURABAYA
- calendar icon
- period
- description

Typography remains independently configurable according to specification.

---

## Certificate

Certificate contains:

- Certificate title;
- certificate card;
- card content.

The final visual decision is:

`1 certificate = 1 card`

The card can be dragged but cannot be freely resized according to the established specification.

Internal card content follows the card layout.

Internal typography/size settings remain independently configurable where specified.

---

## Contact

The following are independent elements:

- LET'S WORK
- TOGETHER
- CLICK HERE
- main PNG image
- decorative elements when available

They must not automatically move or resize together.

---

# 15. Position system

Where the specification defines normalized positioning, use normalized coordinates rather than hard-coded viewport-dependent pixel coordinates.

Position and size are separate states.

Changing position MUST NOT automatically change size.

Changing size MUST NOT automatically change position unless explicitly required by specification.

Do not create layout behavior that causes unrelated elements to move automatically.

---

# 16. Resize system

Resize behavior must follow the exact specification for each element.

Do not add resize controls merely because an element is draggable.

An element that is defined as:

`draggable only`

MUST NOT receive a resize system.

Do not assume that every card is resizable.

Do not assume that every image is resizable unless the specification allows it.

Do not assume that text can be resized by dragging its bounding box if the specification defines font-size control instead.

---

# 17. Typography

Typography is independently controlled where specified.

Do not couple font size between unrelated elements.

For example:

Changing the font size of:

`LET'S WORK`

must not automatically change:

`TOGETHER`

unless explicitly specified.

Similarly, changing a section title must not automatically change card typography.

Font family must follow the project specification.

Do not introduce external fonts freely when the specification does not authorize them.

If the required font family is not specified:

`Tidak ditemukan dalam specification.`

---

# 18. Color

Use color values defined by the project specification when available.

Where a design reference provides visual color information, use the reference for visual comparison.

Do not invent colors merely to make a design look aesthetically pleasing.

Do not replace specified colors with arbitrary alternatives.

Color state must remain independent where the specification requires independent color control.

---

# 19. Responsive behavior

Responsive behavior MUST follow:

`md/08-responsive-spec.md`

and other relevant specification files.

Do not invent responsive breakpoints or behaviors when they are not specified.

Do not automatically rearrange elements simply because a responsive layout seems preferable.

If responsive behavior is not defined:

`Tidak ditemukan dalam specification.`

---

# 20. Motion and interaction

Motion and interaction MUST follow:

`md/07-motion-interaction.md`

and relevant specification files.

Do not invent:

- animation duration;
- easing;
- scroll behavior;
- hover behavior;
- entrance animation;
- transition;
- parallax;
- rotation;
- gesture behavior.

If not specified:

`Tidak ditemukan dalam specification.`

---

# 21. Asset handling

Use assets according to:

`md/09-asset-content-map.md`

and the actual assets available under the project.

Do not replace an existing design asset with an invented asset.

Do not modify design references.

Do not generate substitute assets unless explicitly requested.

If an asset referenced by specification is missing, report it.

Do not silently create a replacement.

---

# 22. Project structure

Respect the established project structure.

Primary directories include:

```text
portfolio-project/
├── AGENTS.md
├── PROJECT-IMPLEMENTATION-LOG.md
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── index.html
│
├── md/
├── design/
├── public/
├── src/
└── tests/


Do not restructure the project without a specification-based reason or explicit user approval.

23. Specification directory

All Markdown specification files under:

md/

must be treated as project documentation.

Do not:

delete them;
rename them;
merge them;
rewrite them;
summarize them into replacements;
remove rules from them;

unless explicitly authorized by the user.

When asked to read specifications, read all relevant files rather than selectively reading only convenient portions.

24. Design directory

All files under:

design/

are protected design references.

Do not:

delete;
rename;
move;
overwrite;
modify;
compress;
replace;

design references unless explicitly authorized.

Design references must remain available for repeated visual verification.

25. Read-only requests

If the user explicitly requests:

audit;
inspection;
analysis;
visual test;
specification review;
read-only;

then:

DO NOT modify files.

DO NOT install packages.

DO NOT create components.

DO NOT create CSS.

DO NOT create code.

DO NOT modify configuration.

Perform only the requested inspection.

26. Planning requests

If the user requests a plan:

DO NOT implement the plan.

A plan is not approval to code.

The AI MUST:

inspect required sources;
identify decisions;
identify dependencies;
identify affected files;
identify risks;
identify unresolved decisions.

Then stop and wait for approval if approval is required.

27. Implementation phases

Implementation must be incremental.

Do not implement the entire website when the user requests a specific phase.

Respect explicit phase boundaries.

For every phase:

read the persistent project log;
read relevant specifications;
read the approved implementation plan;
inspect current files;
identify affected files;
state intended changes when required;
implement only the approved scope;
validate;
update the project log;
stop at the phase boundary.

Do not automatically continue into the next phase.

28. Phase 1 baseline

Phase 1 has been completed.

The approved Phase 1 scope consisted of project foundation:

Vue 3;
TypeScript;
Vite;
Tailwind;
Vue Router;
Pinia;
application bootstrap;
basic router configuration;
TypeScript configuration;
Vite configuration;
HTML entry point;
App.vue;
main.ts;
Vue type declaration.

Phase 1 explicitly did NOT include:

Portfolio UI;
About UI;
Education UI;
College UI;
SHS UI;
Experience UI;
Certificate UI;
Contact UI;
visual editor;
admin editor;
drag system;
resize system;
Supabase;
database;
authentication;
section animation;
section responsive implementation.

Phase 1 validation was completed successfully.

Do not repeat Phase 1 unless explicitly requested.

29. Dependency policy

Do not install packages without user approval when the project instructions require approval.

At the current established baseline:

Installed core dependencies include:

Vue;
Vue Router;
Pinia;
Vite;
TypeScript;
Vue TypeScript tooling;
Tailwind;
Tailwind Vite integration;
Lucide Vue integration.

Previously deferred dependencies include:

@vueuse/core;
zod;
@supabase/supabase-js.

Do not install deferred dependencies unless the relevant implementation phase requires them and the user authorizes installation.

Do not add unrelated packages simply because they may be convenient.

30. Vue architecture

Use Vue 3 and TypeScript.

Follow the approved project architecture.

Do not create unnecessary components.

Do not create placeholder components merely to satisfy a route.

Do not create empty visual sections merely to satisfy an implementation sequence.

Component boundaries must be based on:

specification;
approved implementation plan;
actual reusable behavior.
31. Router policy

Router configuration must follow the approved routing strategy.

Do not create route target components before their implementation phase merely to satisfy route imports.

Do not create visual page stubs unless explicitly authorized.

When a route is specified but its target component has not yet been approved for implementation, do not invent a target component.

32. Admin/editor policy

The admin/editor system must follow the specification.

Do not build the admin editor before its implementation phase.

Do not automatically expose editing controls for every element.

Only expose:

drag;
resize;
typography;
color;
position;
rotation;
other controls;

when explicitly supported by the specification for that element.

33. No automatic coupling

The following must not automatically propagate between unrelated objects:

position;
size;
width;
height;
font size;
font weight;
color;
rotation;
visibility;
drag state.

Only explicit groups may share movement behavior.

A drag group does not automatically create a typography group.

34. Certificate rules

The final established Certificate decision is:

1 certificate = 1 card

Certificate rules:

Certificate title is independent.
Certificate card is draggable.
Certificate card is not freely resizable when specification defines draggable-only.
Card internal content follows the card layout.
Certificate title text size is independently configurable where specified.
Certificate date/year typography is independently configurable where specified.
Calendar icon size is independently configurable where specified.
Description typography is independently configurable where specified.
Certificate changes must not affect other sections.

Visual buttons shown in the Certificate design reference are considered part of the final visual design according to the established user decision.

35. Contact rules

Contact contains independent elements:

LET'S WORK;
TOGETHER;
CLICK HERE;
main PNG image;
decorative elements when actually available in the design.

Each supported element can have its own:

position;
size;
typography;
width;
height;

according to its specific specification.

Moving or resizing one element must not automatically move or resize another.

36. Experience rules

Do not assume that all Experience content is visible in one viewport.

The established interpretation is that the Experience design uses a two-viewport/scroll concept and the fourth item may appear clipped because of that visual composition.

Do not interpret clipping as a missing implementation automatically.

Always compare the implementation against the actual design reference.

37. User decisions are authoritative

Explicit user decisions must be respected.

Examples include:

visual design follows the design reference;
Markdown acts as technical/behavioral complement;
Certificate uses one certificate per card;
visual buttons shown in the Certificate reference are final visual elements;
Experience clipping can be intentional due to the two-viewport scroll concept.

If a later user instruction changes one of these decisions, follow the later instruction.

Record the change in:

PROJECT-IMPLEMENTATION-LOG.md

38. Testing and validation

After implementation, perform validation appropriate to the scope.

Possible validation includes:

TypeScript type checking;
Vue type checking;
production build;
runtime verification;
browser rendering;
responsive verification;
interaction verification;
visual comparison.

Do not claim a test passed unless it was actually executed.

Do not hide errors.

If a validation cannot be performed, state why.

39. Build policy

Before reporting implementation as complete:

check for TypeScript errors;
check for Vue type errors where applicable;
run the required build;
inspect unresolved imports;
inspect runtime errors where applicable.

A successful build does NOT automatically mean visual accuracy.

Visual implementation also requires visual comparison.

40. File safety

Before modifying files, identify the intended files.

Do not modify unrelated files.

Do not perform broad automated rewrites across the repository unless explicitly authorized.

Do not delete files to solve an error without first establishing that deletion is allowed.

Do not overwrite design references or specifications.

41. Git and change tracking

If the repository is a Git repository:

inspect relevant git status;
inspect relevant git diff;
use git history only when needed to understand project state.

If Git is unavailable, do not pretend that git verification was performed.

Use direct file inspection instead.

42. Error handling

When an error occurs:

report the actual error;
identify its source;
determine whether it is caused by the current change;
check the specification;
do not apply unrelated fixes;
do not create placeholder code merely to hide the error;
ask for a decision if the correct resolution is ambiguous.

Do not hide errors by weakening validation.

43. Placeholder policy

Do not create placeholder:

pages;
components;
sections;
CSS;
data;
assets;
routes;
admin controls;

merely to make the project compile.

A placeholder is allowed only when explicitly requested or explicitly defined by the specification.

44. No premature optimization

Do not introduce architecture solely because it is considered "best practice" if the specification does not require it.

Do not add:

libraries;
abstractions;
state layers;
utilities;
patterns;
plugins;

without a traceable reason.

Prefer the simplest implementation that satisfies the approved specification.

45. Request execution protocol

For EVERY request, use this workflow:

REQUEST
   ↓
READ PROJECT-IMPLEMENTATION-LOG.md
   ↓
READ RELEVANT AGENTS INSTRUCTIONS
   ↓
READ RELEVANT SPECIFICATIONS
   ↓
READ APPROVED PLAN IF APPLICABLE
   ↓
INSPECT CURRENT PROJECT STATE
   ↓
INSPECT DESIGN REFERENCE IF VISUAL
   ↓
IDENTIFY SCOPE
   ↓
CHECK FOR CONFLICTS
   ↓
EXECUTE ONLY APPROVED SCOPE
   ↓
VALIDATE
   ↓
VISUAL VERIFY IF APPLICABLE
   ↓
UPDATE PROJECT-IMPLEMENTATION-LOG.md
   ↓
REPORT
   ↓
STOP AT REQUESTED BOUNDARY

Do not skip steps simply because the task appears small.

46. Visual implementation execution protocol

For a visual section implementation:

READ SPEC
   ↓
OPEN DESIGN REFERENCE
   ↓
VISUAL INSPECTION
   ↓
IDENTIFY ACTUAL ELEMENTS
   ↓
IMPLEMENT
   ↓
RUN APPLICATION
   ↓
VIEW ACTUAL RESULT
   ↓
REOPEN DESIGN REFERENCE
   ↓
COMPARE
   ↓
LIST DIFFERENCES
   ↓
CORRECT
   ↓
RUN AGAIN
   ↓
COMPARE AGAIN
   ↓
VALIDATE
   ↓
LOG RESULT

The design image must be revisited during the verification process.

Do not depend on the model's previous visual memory.

47. Visual accuracy standard

The objective is not merely functional similarity.

Visual implementation must aim to match the design reference in:

composition;
positioning;
proportions;
color;
typography;
spacing;
layering;
rotation;
decorative elements;
card geometry;
image placement;
button placement;
visible clipping;
responsive composition.

When an exact value is available in the specification, use it.

When a value is only visually observable, compare against the reference.

When neither source defines it:

Tidak ditemukan dalam specification.

Do not invent a value and present it as authoritative.

48. Session handoff

When a new AI/model/session begins work:

read PROJECT-IMPLEMENTATION-LOG.md;
inspect the actual current project state;
identify the last completed request;
identify unresolved decisions;
identify the current implementation phase;
read the relevant specifications;
reopen relevant design references if visual work is continuing.

Do not assume that the previous model's understanding is available.

49. Project log integrity

PROJECT-IMPLEMENTATION-LOG.md must reflect actual project history.

Do not:

fabricate entries;
claim tests that were not run;
claim images were viewed when they were not;
claim files were modified when they were not;
claim a phase was completed when it was not;
erase important previous decisions;
rewrite history merely to make the project appear cleaner.

If a previous decision was changed, record the new decision and preserve the previous context.

50. Protected project sources

The following are protected unless the user explicitly authorizes modification:

AGENTS.md
md/**
design/**

The AI MUST NOT modify these simply to make implementation easier.

PROJECT-IMPLEMENTATION-LOG.md is intentionally different.

It MUST be updated as part of the project workflow.

51. Stop rule

After completing the requested scope:

STOP.

Do not automatically:

continue to another phase;
implement another section;
install another dependency;
refactor unrelated code;
redesign the UI;
create additional components;
add additional functionality.

Wait for the user's next instruction.

52. Final principle

The project must be implemented from evidence, not imagination.

Use:

DESIGN REFERENCE
    = visual truth

MARKDOWN SPECIFICATION
    = technical and behavioral truth

APPROVED IMPLEMENTATION PLAN
    = architectural execution truth

PROJECT-IMPLEMENTATION-LOG.md
    = persistent project history and context

USER'S EXPLICIT INSTRUCTION
    = authoritative current decision

When these sources do not provide an answer, do not invent one.

State the missing information and wait for clarification when necessary.


## Satu catatan penting

Ada satu bagian yang sengaja saya buat tegas:

> **Design reference = visual truth**  
> **Markdown = technical/behavioral truth**

Ini cocok dengan keputusanmu sebelumnya. Jadi kalau nanti Markdown mengatakan sesuatu tetapi **gambar menunjukkan komposisi yang berbeda**, OpenCode tidak boleh langsung mengubah gambar secara imajinatif. Ia harus membedakan:

- apa yang **terlihat di gambar**;
- apa yang **ditentukan Markdown**;
- apa yang **sudah diputuskan oleh kamu**.

Dan untuk coding visual nanti, workflow wajibnya sudah tertanam:

**baca reference → coding → render → buka reference lagi → compare → koreksi → render lagi → compare lagi → log.**

Dengan begitu, OpenCode + model vision tidak cukup hanya "pernah melihat" desain. Ia dipaksa **kembali melihat desain ketika melakukan verifikasi**.