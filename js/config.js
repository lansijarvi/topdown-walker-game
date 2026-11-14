// downtown's own horizontal extent, unchanged from before the farmland/
// seaside area was added - named-street paving, traffic, lamps, and
// wear/labels all stay capped here so none of that city furniture spills
// west into the country (that area lives at x < 0, entirely outside this span)
const DOWNTOWN_W = 4600;
const WORLD_W = 4600;
// downtown's own vertical extent, unchanged from before the wilderness
// was added - named-street paving, traffic, lamps, and wear/labels all
// stay capped here so none of that city furniture spills north into the
// woods (the wilderness lives at y < 0, entirely outside this span)
const WORLD_H = 5000;
const DOWNTOWN_H = WORLD_H;
// the world's northern edge, out past the mountains - negative because
// downtown itself still starts at y = 0, exactly as it always has
const WORLD_TOP = -3700;
// the world's western edge, out past the ocean - negative for the same
// reason: downtown still starts at x = 0. Wide open water past the
// beach, with room to spare for a future surfing feature
const WORLD_LEFT = -4500;
const ROOM_W = 500;
const ROOM_H = 380;
const WALL_THICK = 24;
