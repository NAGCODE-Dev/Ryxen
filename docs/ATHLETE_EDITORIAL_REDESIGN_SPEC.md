# Athlete Editorial Redesign Spec

## Goal

Create a parallel athlete shell in React + Vite that feels sharper, more premium and more alive than the legacy athlete interface, without changing the existing data contracts.

This pilot is intentionally opinionated:

- keep the Ryxen brand
- discard the old athlete layout language
- preserve only session, storage, parser/import contracts and API shape
- ship first around Athlete Today

## Product Surface

Initial surface:

- `/athlete/`
- Athlete Today only
- import review flow included
- History and Account visible as roadmap/fallback, not fully migrated

## Visual Direction

This shell should feel like an athletic editorial product, not a boxed dashboard.

Core traits:

- dark graphite base
- deep layered surfaces
- high contrast typography
- electric blue as primary energy
- ember/orange as secondary heat
- large cards and wide type
- rhythm through spacing and section breaks
- gradients, halos and subtle shapes instead of flat fills
- motion used for section entry and emphasis, never as noise

## Typography

- Display: `Space Grotesk`
- Body/UI: `Manrope`

Rules:

- headings should feel compact and assertive
- metric numbers should read like callouts
- support copy should stay airy and legible

## Color System

Base palette:

- `--rx-bg`: near-black graphite
- `--rx-surface`: deep slate panels
- `--rx-surface-strong`: elevated dark card
- `--rx-line`: subtle bright border
- `--rx-text`: warm white
- `--rx-text-muted`: cool muted gray-blue
- `--rx-accent`: electric blue
- `--rx-accent-2`: ember/orange
- `--rx-success`: mint-green highlight

## Motion

Motion should support hierarchy:

- hero and first cards can rise/fade in
- chip rails and modal sheets can slide with short distance
- hover/focus should feel tactile but restrained

Respect:

- `prefers-reduced-motion`
- persisted user preference for reduced motion when available

## Layout

The new shell must support:

- browser
- PWA
- Capacitor/native

Safe-area rules:

- top chrome and bottom nav must account for safe-area insets
- content should remain usable on tall mobile devices
- cards should stack cleanly from 320px width upward

## Component Set

Base primitives for the pilot:

- `AppFrame`
- `TopBar`
- `BottomNav`
- `Hero`
- `MetricStrip`
- `ChipRail`
- `WorkoutCard`
- `SectionCard`
- `SheetModal`
- `PrimaryAction`
- `SecondaryAction`
- `EmptyState`

## Today Experience

Today should prioritize:

- immediate recognition of the current day
- clear active week/day selection
- workout blocks with readable structure
- imported plan status
- low-friction import CTA
- active review when parsing needs correction

## Copy Tone

Tone should feel:

- performance-oriented
- direct
- premium
- optimistic

Avoid:

- generic dashboard labels
- robotic system wording
- marketing fluff inside the shell

## Accessibility

Minimum bar:

- visible keyboard focus
- semantic buttons and dialogs
- contrast that survives mobile daylight use
- motion reduction support
- interactive targets sized for touch

## Migration Rules

- do not import legacy athlete CSS into the new shell
- do not recreate the old DOM structure
- reuse data and storage contracts, not legacy presentation
- keep a visible fallback path to the legacy athlete experience during rollout
