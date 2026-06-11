import { createClient } from '@/lib/supabase/server'
import ProjectionBoard from '@/components/auction/ProjectionBoard'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ lotId: string }> }

export default async function ProjectionPage({ params }: Props) {
  const { lotId } = await params
  const supabase = await createClient()

  const [{ data: lot }, { data: settings }] = await Promise.all([
    supabase.from('lots')
      .select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(participant_id, lot_id, ownership_percentage, participant:participants(*)), bids(*, participant:participants(*))')
      .eq('id', lotId).single(),
    supabase.from('calcuta_settings').select('*').single(),
  ])

  if (!lot) notFound()

  const normalizedLot = {
    ...lot,
    teams: lot.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [],
  }

  return <ProjectionBoard initialLot={normalizedLot} settings={settings} />
}
