import type {
  Participant,
  Lot,
  LotOwnership,
  PrizeRule,
  SponsorContribution,
  Team,
  PrizeSummary,
  PoolSummary,
  ParticipantSummary,
} from '@/types'

// ─── Participantes ────────────────────────────────────────────────────────────

export function totalBidByParticipant(
  participantId: string,
  lots: Lot[]
): number {
  return lots
    .filter(
      (lot) =>
        lot.status === 'sold' &&
        lot.ownerships?.some((o) => o.participant_id === participantId)
    )
    .reduce((sum, lot) => sum + (lot.final_price ?? 0), 0)
}

export function totalDueByParticipant(
  participantId: string,
  lots: Lot[],
  buyIn: number
): number {
  const totalBids = totalBidByParticipant(participantId, lots)
  return Math.max(buyIn, totalBids)
}

export function balanceDueByParticipant(
  participant: Participant,
  lots: Lot[]
): number {
  const due = totalDueByParticipant(participant.id, lots, participant.buy_in_amount)
  return due - participant.amount_paid
}

// ─── Bolsa ────────────────────────────────────────────────────────────────────

export function totalPool(
  participants: Participant[],
  lots: Lot[],
  sponsors: SponsorContribution[]
): number {
  const participantsTotal = participants.reduce((sum, p) => {
    return sum + totalDueByParticipant(p.id, lots, p.buy_in_amount)
  }, 0)

  const sponsorsTotal = sponsors
    .filter((s) => s.included_in_pool)
    .reduce((sum, s) => sum + s.amount, 0)

  return participantsTotal + sponsorsTotal
}

export function totalCollected(participants: Participant[]): number {
  return participants.reduce((sum, p) => sum + p.amount_paid, 0)
}

export function totalPending(
  participants: Participant[],
  lots: Lot[]
): number {
  return participants.reduce((sum, p) => {
    const balance = balanceDueByParticipant(p, lots)
    return sum + Math.max(0, balance)
  }, 0)
}

// ─── Premios ──────────────────────────────────────────────────────────────────

export function prizeAmount(rule: PrizeRule, pool: number): number {
  if (!rule.enabled) return 0
  return (pool * rule.percentage) / 100
}

export function validatePrizeRules(rules: PrizeRule[]): boolean {
  const activeRules = rules.filter((r) => r.enabled)
  const total = activeRules.reduce((sum, r) => sum + r.percentage, 0)
  return Math.abs(total - 100) < 0.01
}

// ─── Lotes ────────────────────────────────────────────────────────────────────

export function teamToLot(teamId: string, lots: Lot[]): Lot | undefined {
  return lots.find((lot) => lot.teams?.some((t) => t.id === teamId))
}

export function splitPayoutByOwnership(
  totalPayout: number,
  ownerships: LotOwnership[]
): Array<{ participantId: string; amount: number }> {
  return ownerships.map((o) => ({
    participantId: o.participant_id,
    amount: (totalPayout * o.ownership_percentage) / 100,
  }))
}

// ─── Candidatos y ganadores de premios ───────────────────────────────────────

export function currentPrizeCandidates(
  rules: PrizeRule[],
  teams: Team[],
  lots: Lot[]
): PrizeSummary[] {
  return rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((rule) => {
      const candidate = findCurrentCandidate(rule, teams, lots)
      return {
        rule,
        prize_amount: 0, // se calcula con la bolsa real
        current_candidate: candidate,
      }
    })
}

function findCurrentCandidate(
  rule: PrizeRule,
  teams: Team[],
  lots: Lot[]
): PrizeSummary['current_candidate'] {
  let team: Team | undefined

  switch (rule.final_position) {
    case 1: // Campeón
      team = teams.find((t) => t.current_status === 'champion')
      if (!team) {
        // Si no hay campeón aún, buscar el que va mejor
        team = findBestTeam(teams)
      }
      break

    case 2: // Subcampeón
      team = teams.find((t) => t.current_status === 'runner_up')
      if (!team) {
        team = findSecondBestTeam(teams)
      }
      break

    case 3: // Tercer lugar
      team = teams.find((t) => t.current_status === 'third_place')
      break

    case 32: // Lugar 32 (primero eliminado en 16avos)
      team = findWorstSurvivorAt32(teams)
      break

    case 48: // Último lugar
      team = findLastPlace(teams)
      break

    default:
      team = teams.find((t) => t.final_position === rule.final_position)
  }

  if (!team) return undefined

  const lot = teamToLot(team.id, lots)
  if (!lot) return undefined

  return {
    team,
    lot,
    ownerships: lot.ownerships ?? [],
  }
}

function findBestTeam(teams: Team[]): Team | undefined {
  const priority: Record<string, number> = {
    champion: 10,
    runner_up: 9,
    third_place: 8,
    semifinal: 7,
    quarterfinal: 6,
    round_of_16: 5,
    round_of_32: 4,
    group_stage: 3,
  }

  return teams
    .filter((t) => t.current_status !== 'eliminated' && t.current_status !== 'not_started')
    .sort((a, b) => {
      const pa = priority[a.current_status] ?? 0
      const pb = priority[b.current_status] ?? 0
      if (pa !== pb) return pb - pa
      // Desempate: más puntos, mejor diferencia de goles
      if (a.current_points !== b.current_points) return b.current_points - a.current_points
      return b.current_goal_diff - a.current_goal_diff
    })[0]
}

function findSecondBestTeam(teams: Team[]): Team | undefined {
  const best = findBestTeam(teams)
  if (!best) return undefined

  return teams
    .filter((t) => t.id !== best.id && t.current_status !== 'eliminated' && t.current_status !== 'not_started')
    .sort((a, b) => {
      if (a.current_points !== b.current_points) return b.current_points - a.current_points
      return b.current_goal_diff - a.current_goal_diff
    })[0]
}

function findWorstSurvivorAt32(teams: Team[]): Team | undefined {
  // Primer eliminado en la ronda de 16avos (peor clasificado que llega hasta ahí)
  const at32 = teams.filter(
    (t) => t.current_status === 'round_of_32' || t.current_status === 'eliminated'
  )
  if (at32.length === 0) return undefined

  return at32.sort((a, b) => {
    if (a.current_points !== b.current_points) return a.current_points - b.current_points
    return a.current_goal_diff - b.current_goal_diff
  })[0]
}

function findLastPlace(teams: Team[]): Team | undefined {
  if (teams.length === 0) return undefined

  // Solo mostrar candidato cuando hay equipos con partidos jugados
  const withMatches = teams.filter((t) => t.matches_played > 0)
  if (withMatches.length === 0) return undefined // torneo no iniciado

  const eliminated = teams.filter(
    (t) => t.current_status === 'eliminated' && t.final_position !== undefined
  )
  if (eliminated.length > 0) {
    return eliminated.sort((a, b) => (b.final_position ?? 0) - (a.final_position ?? 0))[0]
  }

  // Durante fase de grupos: peor récord entre equipos que ya jugaron
  return withMatches
    .filter((t) => t.current_status === 'group_stage')
    .sort((a, b) => {
      if (a.current_points !== b.current_points) return a.current_points - b.current_points
      if (a.current_goal_diff !== b.current_goal_diff) return a.current_goal_diff - b.current_goal_diff
      return b.goals_against - a.goals_against
    })[0]
}

// ─── Payouts finales ──────────────────────────────────────────────────────────

export function payoutByParticipant(
  participantId: string,
  rules: PrizeRule[],
  teams: Team[],
  lots: Lot[],
  pool: number
): number {
  let total = 0

  for (const rule of rules) {
    if (!rule.enabled) continue
    const candidate = findCurrentCandidate(rule, teams, lots)
    if (!candidate) continue

    const lotOwnerships = candidate.ownerships
    const ownership = lotOwnerships.find((o) => o.participant_id === participantId)
    if (!ownership) continue

    const prize = prizeAmount(rule, pool)
    total += (prize * ownership.ownership_percentage) / 100
  }

  return total
}

export function netProfitByParticipant(
  participant: Participant,
  lots: Lot[],
  rules: PrizeRule[],
  teams: Team[],
  pool: number
): number {
  const paid = totalDueByParticipant(participant.id, lots, participant.buy_in_amount)
  const payout = payoutByParticipant(participant.id, rules, teams, lots, pool)
  return payout - paid
}

// ─── Summary completo ─────────────────────────────────────────────────────────

export function buildParticipantSummaries(
  participants: Participant[],
  lots: Lot[],
  rules: PrizeRule[],
  teams: Team[],
  pool: number
): ParticipantSummary[] {
  return participants.map((p) => {
    const total_bids = totalBidByParticipant(p.id, lots)
    const total_due = totalDueByParticipant(p.id, lots, p.buy_in_amount)
    const balance_due = total_due - p.amount_paid
    const expected_payout = payoutByParticipant(p.id, rules, teams, lots, pool)
    const lots_owned = lots.filter(
      (l) => l.status === 'sold' && l.ownerships?.some((o) => o.participant_id === p.id)
    ).length

    let payment_status: 'pending' | 'partial' | 'paid' = 'pending'
    if (p.amount_paid >= total_due) payment_status = 'paid'
    else if (p.amount_paid > 0) payment_status = 'partial'

    return {
      ...p,
      total_bids,
      total_due,
      balance_due,
      payment_status,
      lots_owned,
      expected_payout,
      net_profit: expected_payout - total_due,
    }
  })
}

export function buildPoolSummary(
  participants: Participant[],
  lots: Lot[],
  rules: PrizeRule[],
  teams: Team[],
  sponsors: SponsorContribution[]
): PoolSummary {
  const pool = totalPool(participants, lots, sponsors)

  return {
    total_participants: participants.length,
    total_pool: pool,
    total_collected: totalCollected(participants),
    total_pending: totalPending(participants, lots),
    lots_sold: lots.filter((l) => l.status === 'sold').length,
    lots_pending: lots.filter((l) => l.status === 'pending' || l.status === 'active').length,
    sponsors_total: sponsors.filter((s) => s.included_in_pool).reduce((sum, s) => sum + s.amount, 0),
    prizes: currentPrizeCandidates(rules, teams, lots).map((p) => ({
      ...p,
      prize_amount: prizeAmount(p.rule, pool),
    })),
  }
}

// ─── Validaciones ─────────────────────────────────────────────────────────────

export function validateBidIncrement(
  newBid: number,
  currentBid: number,
  minIncrement: number
): { valid: boolean; message?: string } {
  if (newBid <= currentBid) {
    return { valid: false, message: `El bid debe ser mayor al actual ($${currentBid.toLocaleString('es-MX')})` }
  }
  if (newBid < currentBid + minIncrement) {
    return {
      valid: false,
      message: `El incremento mínimo es $${minIncrement.toLocaleString('es-MX')}. Bid mínimo: $${(currentBid + minIncrement).toLocaleString('es-MX')}`,
    }
  }
  return { valid: true }
}

export function validateOwnershipSum(
  ownerships: Array<{ ownership_percentage: number }>
): { valid: boolean; message?: string } {
  const total = ownerships.reduce((sum, o) => sum + o.ownership_percentage, 0)
  if (Math.abs(total - 100) > 0.01) {
    return { valid: false, message: `La copropiedad suma ${total.toFixed(2)}%, debe ser exactamente 100%` }
  }
  return { valid: true }
}

// ─── Formateo ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
