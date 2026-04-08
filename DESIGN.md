# Design System — Scenic Travel Route

## Product Context

- **What this is:** AI-powered scenic road-trip planner that turns any A-to-B drive into a scenic journey
- **Who it's for:** Everyone who wants to plan scenic routes before traveling
- **Space/industry:** Travel planning, mapping, road trip apps
- **Project type:** Map-first web app with desktop sidebar + mobile bottom sheet

## Aesthetic Direction

- **Direction:** Expressive Adventure — The UI should feel like looking through a travel magazine, not a GPS navigation tool
- **Decoration level:** Intentional — Subtle gradients evoking sky/horizon, warm stone backgrounds, textured cards
- **Mood:** Wanderlust, exploration, discovery. The app should feel like planning an adventure, not logistics
- **Reference sites:** Wanderlog, Roadtrippers (map-first layout), travel magazines

## Typography

- **Display/Hero:** Space Grotesk — Bold, geometric, adventurous. Signals "we're not a utility"
- **Body:** DM Sans — Highly readable at all sizes, works well on maps and cards
- **UI/Labels:** Same as body
- **Data/Tables:** Geist Mono — For distances, travel times, coordinates
- **Code:** JetBrains Mono — For any technical display
- **Loading:** Google Fonts CDN
- **Scale:** 11px (labels) / 13px (meta) / 15px (body) / 18px (headings) / 24px+ (display)

## Color

- **Approach:** Expressive — Color is a primary design tool, not just functional
- **Primary (Amber):** #F5A623 — Horizon, sunset, golden hour, warmth
- **Primary Dark:** #D4900A — For hover/active states
- **Secondary (Teal):** #1A7F7F — Water, depth, calm contrast
- **Secondary Light:** #2AA3A3 — For highlights
- **Accent (Coral):** #E86B5D — Route differentiation, energy
- **Success (Sage):** #7BA05B — Positive states
- **Sky:** #6BAED6 — Gradient accents
- **Neutrals (Warm Stone):**
  - Background: #FAF7F2 (not cold white)
  - Surface: #F5F0E8
  - Border: #E8E0D4
  - Muted: #A89F91
  - Text Secondary: #6B6359
  - Text Primary: #3D3832
  - Dark: #2A2622

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable — Cards have 16px internal padding, 24px gap between cards
- **Scale:** 2px / 4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px

## Layout

- **Approach:** Map-dominant with editorial card design
- **Desktop:** Sidebar (380px) + Map (remaining space)
- **Mobile:** Full-screen map + floating search + bottom sheet
- **Max content width:** N/A (map takes what it needs)
- **Border radius:** sm: 6px / md: 12px / lg: 20px / full: 9999px

## Motion

- **Approach:** Minimal-functional with intentional moments — Nothing that distracts from the map
- **Easing:** ease-out (enter) / ease-in (exit) / ease-in-out (move)
- **Duration:**
  - Micro: 50-100ms (button presses)
  - Short: 150-250ms (hover states, toggles)
  - Medium: 250-400ms (card entrances, state changes)
  - Long: 400-700ms (page transitions)
- **Card entrance:** Staggered fade + translateY (100ms delay between cards)
- **Route draw:** Polyline animates from origin to destination

## Map Design

### Map Style
- **Default:** Mapbox Outdoors terrain style
- **Alternative:** Satellite hybrid view
- **Custom:** Scenic Heat overlay showing scenic density zones

### Route Visualization
- **Gradient polylines:** Route lines use color gradients (amber → coral → teal) rather than solid colors
- **Animated draw:** Routes animate from origin to destination like a path being traced
- **Varying width:** Scenic segments (coastlines, mountain roads) slightly thicker than highway stretches
- **Color coding:**
  - Most Scenic: Amber gradient
  - Balanced: Teal → Sky gradient
  - Fastest: Neutral gray

### POI Markers
- **Custom icons:** Scenic categories use emoji markers (🏖️ beach, 🏔️ mountain, 🌅 sunset, 🛶 village)
- **Scenic pulse:** High-scoring POIs have subtle glow animation
- **Click behavior:** Opens info popup with name and distance from start

### Scenic Photos on Map
- **Photo thumbnails:** Rounded rectangles positioned along the route polyline
- **Thumbnail size:** 48px with 3px white border and shadow
- **Hover:** Scale up with stronger shadow
- **Click:** Opens large popup (400px wide) with full photo, caption, and location metadata
- **Toggle:** Photos can be toggled on/off via map button

### Map Overlays
- **Focus Map mode:** Hides all overlays (legend, route info, toggle buttons) for clean map view
- **Layer controls:** Terrain / Satellite / Scenic Heat toggles
- **Quick toggles:** Photos / Focus Map buttons

## Route Cards

### Card Structure
1. **Preview header:** Gradient background (color-coded by route type: coast blue/teal, mountain gray/green, forest sage/teal)
2. **Scenic badge:** Score pill (e.g., "9.1 Scenic Score") positioned top-left
3. **Vibe tag:** Short descriptor (e.g., "Beach & Culture") positioned bottom-left
4. **Content section:**
   - Route name (Space Grotesk, bold)
   - Duration
   - Stats row (distance, time added)
   - Description paragraph
   - Highlight tags (🏖️ Beach Views, 🌅 Sunset Point, etc.)
   - "X scenic photos on map" indicator with camera icon

### Card States
- **Default:** White background, subtle shadow, 1px border
- **Hover:** Lift effect (translateY -4px), stronger shadow, amber border
- **Selected:** Teal border with glow shadow

### Animation
- Cards stagger in on load: fade + translateY(20px), 100ms delay between cards

## Search Form

### Desktop
- Compact card floated in sidebar
- Two input fields (origin, destination) with location icons
- Swap button between inputs with rotation animation
- Single CTA button: "Find Scenic Routes"
- Amber gradient with glow shadow

### Mobile
- Floating form at top of map
- Inline layout: Start → Destination in one row
- Full-width CTA button below
- 48px touch targets

## Mobile UX

### Bottom Sheet
- **Peek state (default):** Shows selected route card header only (~100px)
- **Expanded state:** Full route cards with scroll (max 70vh)
- **Drag behavior:** Swipe up to expand, swipe down to minimize
- **Tap to expand:** Tapping peek content also expands

### Map Adaptation
- Toggle buttons show icons only (no text)
- Legend shows color dots only (no labels)
- Overlays positioned above bottom sheet

## Component Inventory

### Buttons
- **Primary CTA:** Amber gradient, white text, glow shadow, scale on press
- **Secondary:** White background, teal border on hover
- **Ghost/Icon:** Transparent, icon only, circle background on hover

### Input Fields
- **Default:** 2px border (#E8E0D4), stone background
- **Focus:** Amber border, amber glow shadow
- **Icons:** 20px, muted color, positioned left

### Cards
- White background, lg border-radius (20px), md shadow
- 16px internal padding

### Tags/Badges
- Full border-radius (pill shape)
- 4px vertical / 10px horizontal padding
- Subtle background color

### Popups (Map)
- 12px border-radius
- No padding (for photos) or 16px padding (for text)
- White close button (circle, top-right)

## Dark Mode

Not implemented in initial release. Future consideration:
- Invert neutrals: stone-50 → stone-900
- Reduce saturation 10-20%
- Keep amber/teal accents

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Initial design system created | Created by /design-consultation based on scenic route planner product context |
| 2026-04-08 | Expressive Adventure aesthetic | User wanted more visual appeal than a typical navigation app |
| 2026-04-08 | Space Grotesk for display | Bold, adventurous feel — not a utility |
| 2026-04-08 | Amber primary color | Evokes horizon, sunset, golden hour — scenic |
| 2026-04-08 | Photos on map, not card strip | User preferred scenic photos integrated with route visualization |
| 2026-04-08 | Light mode only | User confirmed single theme is sufficient |
| 2026-04-08 | Mobile floating search + draggable sheet | Proper mobile-first experience with touch-optimized interactions |
