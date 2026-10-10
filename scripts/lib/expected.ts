import { ageRange, type AgeGroup, type PracticeKind } from "@mourabbi/schemas";

/** The 34 templates required by the brief (section 5.6). Used to catch drift in the data files. */
export interface ExpectedTemplate {
  n: number;
  id: string;
  kind: PracticeKind;
  ages: [AgeGroup, AgeGroup];
  players: [number, number];
  area: [number, number];
  seed?: boolean;
}

const t = (
  n: number, id: string, kind: PracticeKind, from: AgeGroup, to: AgeGroup,
  min: number, max: number, l: number, w: number, seed = false,
): ExpectedTemplate => ({ n, id, kind, ages: [from, to], players: [min, max], area: [l, w], seed });

export const EXPECTED: ExpectedTemplate[] = [
  t(1, "dynamic_warmup_ball", "warmup", "U8", "senior", 6, 30, 20, 20, true),
  t(2, "colour_gates_dribble", "warmup", "U6", "U12", 6, 24, 20, 20),
  t(3, "tag_with_ball", "warmup", "U8", "U13", 8, 24, 20, 20),
  t(4, "pairs_passing_warmup", "warmup", "U10", "senior", 6, 30, 20, 15),
  t(5, "rondo_4v2_u10", "technical", "U9", "U11", 6, 10, 15, 15, true),
  t(6, "rondo_3v1_u8", "technical", "U7", "U9", 4, 8, 10, 10),
  t(7, "rondo_5v2_u13", "technical", "U12", "U15", 7, 14, 18, 18),
  t(8, "passing_square_u12", "technical", "U11", "U14", 8, 16, 20, 20),
  t(9, "passing_diamond_u14", "technical", "U13", "U17", 8, 16, 25, 25),
  t(10, "receive_and_turn_gates_u12", "technical", "U10", "U13", 6, 14, 20, 15),
  t(11, "wall_pass_combination_u13", "technical", "U12", "U15", 6, 14, 25, 20),
  t(12, "dribble_gates_u8", "technical", "U7", "U10", 6, 16, 20, 20),
  t(13, "one_v_one_to_mini_goals_u10", "game_related", "U9", "U12", 6, 16, 20, 15),
  t(14, "one_v_one_defending_channel_u13", "technical", "U12", "U15", 6, 16, 25, 10),
  t(15, "obstacle_relay_u9", "technical", "U8", "U10", 8, 20, 25, 15),
  t(16, "two_v_one_overload_u11", "game_related", "U10", "U12", 6, 12, 20, 15),
  t(17, "receive_turn_and_shoot_u12", "technical", "U11", "U13", 6, 14, 30, 25),
  t(18, "crossing_and_finishing_u15", "technical", "U14", "U17", 8, 16, 35, 30),
  t(19, "two_goal_finishing_race_u13", "game_related", "U12", "U15", 8, 14, 30, 25),
  t(20, "shooting_from_combination_u16", "technical", "U15", "senior", 8, 16, 35, 30),
  t(21, "goalkeeper_distribution_u14", "technical", "U12", "U17", 4, 10, 30, 25),
  t(22, "corner_goals_3v3_u12", "game_related", "U11", "U13", 6, 12, 30, 20, true),
  t(23, "possession_4v4_plus_2_u14", "game_related", "U13", "U16", 10, 14, 35, 25),
  t(24, "possession_5v2_zone_u15", "game_related", "U14", "U17", 9, 14, 30, 25),
  t(25, "three_zone_possession_u16", "main", "U15", "senior", 12, 18, 40, 30),
  t(26, "numbers_up_attack_3v2_u12", "game_related", "U11", "U14", 8, 14, 30, 25),
  t(27, "transition_4v4_four_goals_u13", "game_related", "U12", "U15", 8, 14, 35, 25),
  t(28, "buildout_4v2_u14", "main", "U13", "U16", 8, 14, 25, 20, true),
  t(29, "pressing_triggers_6v4_u16", "main", "U15", "senior", 10, 16, 40, 30),
  t(30, "counter_press_5v5_u15", "main", "U14", "U17", 10, 16, 40, 30),
  t(31, "defensive_shape_4v3_u16", "main", "U15", "senior", 8, 14, 35, 30),
  t(32, "small_sided_game_5v5", "game", "U9", "U19", 8, 20, 40, 30, true),
  t(33, "four_goal_game_u11", "game", "U10", "U12", 8, 16, 35, 25),
  t(34, "cooldown_walk_stretch", "cooldown", "U6", "senior", 4, 40, 15, 15, true),
];

export const expectedAges = (e: ExpectedTemplate): AgeGroup[] => ageRange(e.ages[0], e.ages[1]);
