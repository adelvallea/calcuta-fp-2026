// ─── Enums ────────────────────────────────────────────────────────────────────

export type LotStatus = 'pending' | 'active' | 'sold' | 'paused' | 'cancelled'
export type LotType = 'solo' | 'combo'
export type TeamStatus =
  | 'not_started'
  | 'group_stage'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'third_place'
  | 'runner_up'
  | 'champion'
  | 'eliminated'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type ResultSource = 'manual' | 'api' | 'official_fifa'

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Participant {
  id: string
  name: string
  email?: string
  phone?: string
  buy_in_amount: number
  amount_paid: number
  notes?: string
  created_at: string
}

export interface Team {
  id: string
  name: string
  country_code: string // ISO 3166-1 alpha-3
  fifa_rank: number
  pot: number // 1-4
  best_world_cup: string
  world_cup_2022: string
  confederation: string
  group_wc2026?: string
  current_status: TeamStatus
  final_position?: number
  current_points: number
  current_goal_diff: number
  matches_played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
}

export interface Lot {
  id: string
  number: number
  title: string
  type: LotType
  status: LotStatus
  current_bid: number
  final_price?: number
  notes?: string
  created_at: string
  // Joined fields
  teams?: Team[]
  ownerships?: LotOwnership[]
  bids?: Bid[]
}

export interface LotTeam {
  lot_id: string
  team_id: string
}

export interface Bid {
  id: string
  lot_id: string
  participant_id: string
  amount: number
  created_at: string
  created_by: string
  // Joined
  participant?: Participant
}

export interface LotOwnership {
  lot_id: string
  participant_id: string
  ownership_percentage: number
  // Joined
  participant?: Participant
}

export interface Payment {
  id: string
  participant_id: string
  amount: number
  method?: string
  date: string
  notes?: string
  created_at: string
  // Joined
  participant?: Participant
}

export interface PrizeRule {
  id: string
  name: string
  description?: string
  final_position: number
  percentage: number
  enabled: boolean
  sort_order: number
}

export interface SponsorContribution {
  id: string
  name: string
  amount: number
  included_in_pool: boolean
  notes?: string
  date: string
  created_at: string
}

export interface Match {
  id: string
  home_team_id: string
  away_team_id: string
  home_score?: number
  away_score?: number
  status: 'scheduled' | 'live' | 'finished'
  kickoff?: string
  stage: string
  group?: string
  source: ResultSource
  updated_at: string
  // Joined
  home_team?: Team
  away_team?: Team
}

export interface TournamentStanding {
  team_id: string
  position?: number
  source: ResultSource
  updated_at: string
  // Joined
  team?: Team
}

export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  performed_by: string
  created_at: string
}

// ─── Settings / Config ────────────────────────────────────────────────────────

export interface CalcutaSettings {
  id: string
  event_name: string
  buy_in_amount: number
  min_bid_increment: number
  currency: string
  currency_symbol: string
  auction_started: boolean
  auction_finished: boolean
  current_lot_id?: string
  created_at: string
  updated_at: string
}

// ─── Calculated / view types ──────────────────────────────────────────────────

export interface ParticipantSummary extends Participant {
  total_bids: number
  total_due: number
  balance_due: number
  payment_status: PaymentStatus
  lots_owned: number
  expected_payout: number
  net_profit: number
}

export interface PrizeSummary {
  rule: PrizeRule
  prize_amount: number
  current_candidate?: {
    team: Team
    lot: Lot
    ownerships: LotOwnership[]
  }
  final_winner?: {
    team: Team
    lot: Lot
    payouts: Array<{ participant: Participant; amount: number }>
  }
}

export interface PoolSummary {
  total_participants: number
  total_pool: number
  total_collected: number
  total_pending: number
  lots_sold: number
  lots_pending: number
  sponsors_total: number
  prizes: PrizeSummary[]
}
